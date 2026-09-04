import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { compare as bcryptCompare } from 'bcrypt';
import * as crypto from 'crypto';
import {
  BookingStatus,
  DriverStatus,
  AssignmentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BotSenderService } from './services/bot-sender.service';

import type { WebhookUpdateDto } from './dto/webhook-update.dto';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly botSender: BotSenderService,
    @InjectQueue('broadcast') private readonly broadcastQueue: Queue,
    @InjectQueue('assignment-timeout')
    private readonly assignmentTimeoutQueue: Queue,
  ) {}

  // ─── Webhook Handler ───

  async handleWebhook(update: WebhookUpdateDto) {
    const telegramId = this.extractTelegramId(update);
    if (!telegramId) {
      return null;
    }

    // Rate limiting: 30 req/min per telegram_id
    const isAllowed = await this.checkRateLimit(telegramId);
    if (!isAllowed) {
      return { text: 'Rate limit exceeded. Please slow down.' };
    }

    // Idempotency. Telegram retries a webhook until it gets a 200, so the same
    // update can arrive several times — without this, one /online tap could be
    // processed repeatedly.
    //
    // This previously read `update.updateId` but wrote the Redis key from
    // `update.update_id`, which never existed on the parsed DTO. The key was
    // therefore always `telegram:update:undefined` and deduplication never
    // actually fired. Both sides now use the same field.
    const { updateId } = update;
    const isDuplicate = await this.checkDuplicate(updateId);
    if (isDuplicate) {
      this.logger.debug('Duplicate Telegram update ignored', { updateId });
      return null;
    }

    await this.redis
      .getClient()
      .setex(`telegram:update:${updateId}`, 3600, '1');

    return { telegramId, update };
  }

  private async checkRateLimit(telegramId: string): Promise<boolean> {
    const key = `telegram:rate_limit:${telegramId}`;
    const current = await this.redis.getClient().incr(key);

    if (current === 1) {
      await this.redis.getClient().expire(key, 60);
    }

    return current <= 30;
  }

  private async checkDuplicate(updateId: number): Promise<boolean> {
    const exists = await this.redis
      .getClient()
      .exists(`telegram:update:${updateId}`);
    return exists === 1;
  }

  private extractTelegramId(update: WebhookUpdateDto): string | null {
    if (update.message?.from?.id) {
      return String(update.message.from.id);
    }
    if (update.callbackQuery?.from?.id) {
      return String(update.callbackQuery.from.id);
    }
    return null;
  }

  // ─── Driver Status Update (B21 Webhook) ───

  async handleDriverStatusUpdate(dto: {
    telegramId: string;
    vehicleId?: string;
    driverName: string;
    status: DriverStatus;
  }) {
    const telegramIdBigInt = BigInt(dto.telegramId);

    let driver = await this.prisma.driver.findUnique({
      where: { telegramId: telegramIdBigInt },
    });

    if (driver) {
      const data: Prisma.DriverUpdateInput = {
        status: dto.status,
        lastStatusUpdate: new Date(),
        lastTelegramActivity: new Date(),
      };

      if (dto.vehicleId) data.vehicle = { connect: { id: dto.vehicleId } };
      if (dto.driverName) data.driverName = dto.driverName;

      driver = await this.prisma.driver.update({
        where: { id: driver.id },
        data,
      });

      this.logger.log(
        `Driver ${driver.id} status updated to ${dto.status} via Telegram webhook`,
      );
    } else {
      const driverId = `DRV-${dto.telegramId}`;
      const authPin = Math.floor(100000 + Math.random() * 900000).toString();

      driver = await this.prisma.driver.create({
        data: {
          driverName: dto.driverName,
          driverId,
          telegramId: telegramIdBigInt,
          authPin,
          phone: '',
          vehicleId: dto.vehicleId || null,
          status: dto.status,
          lastStatusUpdate: new Date(),
          lastTelegramActivity: new Date(),
        },
      });

      this.logger.log(
        `Driver created: ${driver.id} (${driverId}) via Telegram webhook`,
      );
    }

    await this.redis.getClient().publish(
      `driver_status_changed:${driver.id}`,
      JSON.stringify({
        driverId: driver.id,
        status: dto.status,
        timestamp: new Date().toISOString(),
      }),
    );

    await this.prisma.auditLog.create({
      data: {
        userId: null,
        eventType: 'admin_action',
        entityType: 'DRIVER_STATUS_UPDATE',
        entityId: driver.id,
        metadata: {
          source: 'telegram_webhook',
          telegramId: dto.telegramId,
          status: dto.status,
          vehicleId: dto.vehicleId,
        },
      },
    });

    return {
      driverId: driver.id,
      status: driver.status,
      action:
        driver.driverId === `DRV-${dto.telegramId}` &&
        driver.createdAt.getTime() === driver.updatedAt.getTime()
          ? 'created'
          : 'updated',
    };
  }

  // ─── Driver Registration ───

  async registerDriver(dto: {
    telegramId: string;
    driverId: string;
    pin: string;
  }) {
    const driver = await this.prisma.driver.findUnique({
      where: { driverId: dto.driverId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const pinValid = await bcryptCompare(dto.pin, driver.authPin);
    if (!pinValid) {
      throw new UnauthorizedException('Invalid PIN');
    }

    const updated = await this.prisma.driver.update({
      where: { id: driver.id },
      data: {
        telegramId: BigInt(dto.telegramId),
        lastTelegramActivity: new Date(),
      },
    });

    // Store mapping in Redis (30d TTL)
    await this.redis
      .getClient()
      .setex(
        `telegram_driver:${dto.telegramId}`,
        30 * 24 * 60 * 60,
        JSON.stringify(updated),
      );

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: null,
        eventType: 'admin_action',
        entityType: 'DRIVER_TELEGRAM_REGISTERED',
        entityId: driver.id,
        metadata: {
          telegramId: dto.telegramId,
          driverId: dto.driverId,
        },
      },
    });

    return {
      driverId: updated.id,
      telegramId: dto.telegramId,
      driverName: updated.driverName,
    };
  }

  // ─── Driver Status ───

  async updateDriverStatus(dto: { telegramId: string; status: DriverStatus }) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(dto.telegramId) },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    if (dto.status === DriverStatus.OFFLINE) {
      const activeAssignments = await this.prisma.driverAssignment.count({
        where: {
          driverId: driver.id,
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
      });

      if (activeAssignments > 0) {
        throw new ConflictException(
          'Cannot go offline while you have active assignments',
        );
      }
    }

    const updated = await this.prisma.driver.update({
      where: { id: driver.id },
      data: {
        status: dto.status,
        lastStatusUpdate: new Date(),
        lastTelegramActivity: new Date(),
      },
    });

    // Publish to Redis
    await this.redis.getClient().publish(
      `driver_status_changed:${driver.id}`,
      JSON.stringify({
        driverId: driver.id,
        status: dto.status,
        timestamp: new Date().toISOString(),
      }),
    );

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: null,
        eventType: 'admin_action',
        entityType: 'DRIVER_STATUS_UPDATE',
        entityId: driver.id,
        metadata: {
          source: 'telegram',
          telegramId: dto.telegramId,
          status: dto.status,
        },
      },
    });

    return {
      driverId: updated.id,
      status: updated.status,
    };
  }

  async getDriverInfo(telegramId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
      include: {
        assignments: {
          where: {
            status: { in: ['PENDING', 'ACCEPTED'] },
          },
          orderBy: { assignmentTimestamp: 'desc' },
          take: 5,
        },
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return {
      id: driver.id,
      driverId: driver.driverId,
      driverName: driver.driverName,
      status: driver.status,
      vehicleId: driver.vehicleId,
      phone: driver.phone,
      activeAssignments: driver.assignments.length,
      lastStatusUpdate: driver.lastStatusUpdate,
    };
  }

  // ─── Trip Assignments ───

  async getActiveAssignments(telegramId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return this.prisma.driverAssignment.findMany({
      where: {
        driverId: driver.id,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
      orderBy: { assignmentTimestamp: 'desc' },
      include: {
        driver: {
          select: {
            id: true,
            driverName: true,
          },
        },
      },
    });
  }

  async acceptAssignment(telegramId: string, assignmentId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const [assignment] = await this.prisma.$transaction([
      this.prisma.driverAssignment.update({
        where: { id: assignmentId, driverId: driver.id },
        data: {
          status: AssignmentStatus.ACCEPTED,
          responseTimestamp: new Date(),
        },
      }),
      this.prisma.driver.update({
        where: { id: driver.id },
        data: {
          status: DriverStatus.BUSY,
          lastTelegramActivity: new Date(),
        },
      }),
    ]);

    await this.publishAssignmentEvent(assignment);

    await this.redis.getClient().publish(
      `driver_status_changed:${driver.id}`,
      JSON.stringify({
        driverId: driver.id,
        status: DriverStatus.BUSY,
        timestamp: new Date().toISOString(),
      }),
    );

    return assignment;
  }

  async rejectAssignment(
    telegramId: string,
    assignmentId: string,
    reason?: string,
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const [assignment] = await this.prisma.$transaction([
      this.prisma.driverAssignment.update({
        where: { id: assignmentId, driverId: driver.id },
        data: {
          status: AssignmentStatus.REJECTED,
          responseTimestamp: new Date(),
          rejectionReason: reason || null,
        },
      }),
      this.prisma.driver.update({
        where: { id: driver.id },
        data: {
          status: DriverStatus.AVAILABLE,
          lastTelegramActivity: new Date(),
        },
      }),
    ]);

    await this.publishAssignmentEvent(assignment);

    await this.redis.getClient().publish(
      'driver_assignments',
      JSON.stringify({
        event: 'ASSIGNMENT_REJECTED',
        assignmentId: assignment.id,
        driverId: assignment.driverId,
        reason: assignment.rejectionReason,
        timestamp: new Date().toISOString(),
      }),
    );

    await this.redis.getClient().publish(
      `driver_status_changed:${driver.id}`,
      JSON.stringify({
        driverId: driver.id,
        status: DriverStatus.AVAILABLE,
        timestamp: new Date().toISOString(),
      }),
    );

    return assignment;
  }

  async startTrip(telegramId: string, assignmentId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const assignment = await this.prisma.driverAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment || assignment.driverId !== driver.id) {
      throw new NotFoundException('Assignment not found');
    }

    const [updatedAssignment] = await this.prisma.$transaction([
      this.prisma.driverAssignment.update({
        where: { id: assignmentId },
        data: {
          status: AssignmentStatus.ACCEPTED,
          tripStartTime: new Date(),
        },
      }),
      this.prisma.driver.update({
        where: { id: driver.id },
        data: {
          status: DriverStatus.BUSY,
          lastTelegramActivity: new Date(),
        },
      }),
      // The booking status is deliberately NOT changed when a trip starts.
      //
      // This used to write `'in_progress' as any`. There is no `in_progress`
      // member in the BookingStatus enum (hold, pending_payment, confirmed,
      // cancelled, expired, payment_failed, completed, no_show), so the cast
      // hid an update that Postgres would reject outright. A confirmed booking
      // stays confirmed; the trip's own progress lives on
      // driver_assignments.tripStartTime.
    ]);

    await this.redis.getClient().publish(
      `driver_status_changed:${driver.id}`,
      JSON.stringify({
        driverId: driver.id,
        status: DriverStatus.BUSY,
        timestamp: new Date().toISOString(),
      }),
    );

    return updatedAssignment;
  }

  async completeTrip(telegramId: string, assignmentId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const assignment = await this.prisma.driverAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment || assignment.driverId !== driver.id) {
      throw new NotFoundException('Assignment not found');
    }

    const [updatedAssignment] = await this.prisma.$transaction([
      this.prisma.driverAssignment.update({
        where: { id: assignmentId },
        data: {
          status: AssignmentStatus.COMPLETED,
          completionTimestamp: new Date(),
        },
      }),
      this.prisma.driver.update({
        where: { id: driver.id },
        data: {
          status: DriverStatus.AVAILABLE,
          lastTelegramActivity: new Date(),
        },
      }),
      ...(assignment.bookingId
        ? [
            this.prisma.booking.update({
              where: { id: assignment.bookingId },
              data: { status: BookingStatus.completed },
            }),
          ]
        : []),
    ]);

    await this.redis.getClient().publish(
      `driver_status_changed:${driver.id}`,
      JSON.stringify({
        driverId: driver.id,
        status: DriverStatus.AVAILABLE,
        timestamp: new Date().toISOString(),
      }),
    );

    return updatedAssignment;
  }

  async queueAssignmentTimeout(assignmentId: string) {
    await this.assignmentTimeoutQueue.add(
      'timeout',
      { assignmentId },
      { delay: 5 * 60 * 1000 }, // 5 minutes
    );
  }

  async sendAssignmentNotification(assignmentId: string) {
    const assignment = await this.prisma.driverAssignment.findUnique({
      where: { id: assignmentId },
      include: { driver: true },
    });

    if (!assignment) {
      this.logger.warn(`Assignment ${assignmentId} not found for notification`);
      return;
    }

    if (!assignment.driver.telegramId) {
      this.logger.warn(
        `Driver ${assignment.driver.id} has no telegram_id, skipping notification`,
      );
      return;
    }

    const booking = assignment.bookingId
      ? await this.prisma.booking.findUnique({
          where: { id: assignment.bookingId },
          select: {
            reference: true,
            startDate: true,
            passengerCount: true,
            totalUsd: true,
            user: { select: { fullName: true, phone: true } },
          },
        })
      : null;

    const pickupTime = booking?.startDate
      ? new Date(booking.startDate).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'TBD';

    const message =
      `New Trip Assignment!\n\n` +
      `Pickup: ${pickupTime}\n` +
      `Customer: ${booking?.user?.fullName || 'N/A'}\n` +
      `Passengers: ${booking?.passengerCount || 1}\n` +
      `Booking: ${booking?.reference || 'N/A'}\n\n` +
      `Please respond within 5 minutes`;

    const chatId = String(assignment.driver.telegramId);

    try {
      await this.botSender.sendMessage(chatId, message, {
        replyMarkup: {
          inlineKeyboard: [
            [
              {
                text: 'Accept Trip',
                callbackData: `assignment:accept:${assignmentId}`,
              },
              {
                text: 'Reject Trip',
                callbackData: `assignment:reject:${assignmentId}`,
              },
            ],
          ],
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send assignment notification to ${chatId}: ${(error as Error).message}`,
      );
      return;
    }

    this.logger.log(
      `Sent assignment notification to driver ${assignment.driver.id} (telegram: ${chatId})`,
    );

    return {
      chatId,
      text: message,
      keyboard: {
        inlineKeyboard: [
          [
            {
              text: 'Accept Trip',
              callbackData: `assignment:accept:${assignmentId}`,
            },
            {
              text: 'Reject Trip',
              callbackData: `assignment:reject:${assignmentId}`,
            },
          ],
        ],
      },
    };
  }

  // ─── Trip History & Earnings ───

  async getAssignmentHistory(
    telegramId: string,
    limit: number,
    offset: number,
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const [data, total] = await Promise.all([
      this.prisma.driverAssignment.findMany({
        where: { driverId: driver.id },
        orderBy: { assignmentTimestamp: 'desc' },
        skip: offset,
        take: limit,
        include: {
          driver: {
            select: {
              id: true,
              driverName: true,
            },
          },
        },
      }),
      this.prisma.driverAssignment.count({
        where: { driverId: driver.id },
      }),
    ]);

    return { data, total, limit, offset };
  }

  async getTodayEarnings(telegramId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await this.prisma.driverAssignment.count({
      where: {
        driverId: driver.id,
        status: 'COMPLETED',
        completionTimestamp: { gte: today },
      },
    });

    return { date: today.toISOString().split('T')[0], trip: count };
  }

  async getWeekEarnings(telegramId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const count = await this.prisma.driverAssignment.count({
      where: {
        driverId: driver.id,
        status: 'COMPLETED',
        completionTimestamp: { gte: weekAgo },
      },
    });

    return { since: weekAgo.toISOString().split('T')[0], trip: count };
  }

  // ─── Location ───

  async updateLocation(dto: {
    telegramId: string;
    latitude: number;
    longitude: number;
  }) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(dto.telegramId) },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    // Store in Redis with 5-min TTL
    const locationKey = `driver_location:${driver.id}`;
    await this.redis.getClient().setex(
      locationKey,
      5 * 60,
      JSON.stringify({
        latitude: dto.latitude,
        longitude: dto.longitude,
        timestamp: new Date().toISOString(),
      }),
    );

    // Publish location update
    await this.redis.getClient().publish(
      `driver_location_updated:${driver.id}`,
      JSON.stringify({
        driverId: driver.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        timestamp: new Date().toISOString(),
      }),
    );

    await this.prisma.driver.update({
      where: { id: driver.id },
      data: { lastTelegramActivity: new Date() },
    });

    return {
      driverId: driver.id,
      location: { lat: dto.latitude, lng: dto.longitude },
    };
  }

  // ─── Emergency & Support ───

  async createEmergencyAlert(dto: {
    telegramId: string;
    latitude?: number;
    longitude?: number;
  }) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(dto.telegramId) },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    // Find a system user for the required userId
    const systemUser = await this.prisma.user.findFirst({
      select: { id: true },
    });

    const alert = await this.prisma.emergencyAlert.create({
      data: {
        id: crypto.randomUUID(),
        userId: systemUser?.id || '00000000-0000-0000-0000-000000000000',
        alertType: 'sos',
        status: 'triggered',
        latitude: dto.latitude ?? 0,
        longitude: dto.longitude ?? 0,
        driverId: driver.id,
        notes: `Emergency alert from driver ${driver.driverName} via Telegram`,
        createdAt: new Date(),
      },
    });

    // Notify Admin Panel
    await this.redis.getClient().publish(
      'emergency_alerts',
      JSON.stringify({
        event: 'DRIVER_EMERGENCY',
        alertId: alert.id,
        driverId: driver.id,
        driverName: driver.driverName,
        lat: dto.latitude,
        lng: dto.longitude,
        timestamp: new Date().toISOString(),
      }),
    );

    return alert;
  }

  async createSupportTicket(dto: { telegramId: string; message: string }) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(dto.telegramId) },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const ticketId = `TIX-${Date.now()}`;

    const ticket = await this.prisma.supportTicket.create({
      data: {
        id: crypto.randomUUID(),
        ticketId,
        driverId: driver.id,
        message: dto.message,
        status: 'OPEN',
        priority: 'NORMAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return ticket;
  }

  // ─── Settings ───

  async updateSettings(
    telegramId: string,
    settings: { preferredLanguage?: string },
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const data: Prisma.DriverUpdateInput = {};
    if (settings.preferredLanguage) {
      data.preferredLanguage = settings.preferredLanguage;
    }

    return this.prisma.driver.update({
      where: { id: driver.id },
      data,
    });
  }

  // ─── Broadcast ───

  async createBroadcast(dto: {
    message: string;
    imageUrl?: string;
    targetFilter?: Record<string, unknown>;
    /**
     * The authenticated admin sending this broadcast.
     *
     * Required. The previous implementation picked an arbitrary row from
     * admin_users and fell back to a zero UUID, which recorded the wrong sender
     * and — now that broadcast_messages.sent_by has a real foreign key — would
     * fail outright on an empty admin table.
     */
    sentBy: string;
  }) {
    const broadcast = await this.prisma.broadcastMessage.create({
      data: {
        messageId: `BC-${Date.now()}`,
        content: dto.message,
        imageUrl: dto.imageUrl || null,
        targetFilter: (dto.targetFilter ?? {}) as Prisma.InputJsonValue,
        sentBy: dto.sentBy,
        status: 'PENDING',
        sentCount: 0,
        failedCount: 0,
      },
    });

    // Find target drivers
    const where: Prisma.DriverWhereInput = {};
    if (dto.targetFilter?.status) {
      where.status = dto.targetFilter.status;
    }

    const drivers = await this.prisma.driver.findMany({
      where,
      select: { telegramId: true, id: true },
    });

    const targets = drivers
      .filter((d) => d.telegramId !== null)
      .map((d) => ({
        chatId: String(d.telegramId),
        message: dto.message,
        driverId: d.id,
      }));

    // Queue broadcast job
    await this.broadcastQueue.add('send', {
      broadcastId: broadcast.id,
      targets,
      imageUrl: dto.imageUrl,
    });

    return {
      broadcastId: broadcast.id,
      targetCount: targets.length,
      status: 'QUEUED',
    };
  }

  async getBroadcasts() {
    return this.prisma.broadcastMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ─── Helpers ───

  private async publishAssignmentEvent(assignment: {
    id: string;
    driverId: string;
    status: AssignmentStatus;
  }) {
    try {
      await this.redis.getClient().publish(
        'driver_assignments',
        JSON.stringify({
          assignmentId: assignment.id,
          driverId: assignment.driverId,
          status: assignment.status,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to publish assignment event: ${(error as Error).message}`,
      );
    }
  }
}
