import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  AuditEventType,
  AssignmentStatus,
  DriverStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { TelegramService } from '../../telegram/telegram.service';

@Injectable()
export class AdminAssignmentsService {
  private readonly logger = new Logger(AdminAssignmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly telegramService: TelegramService,
  ) {}

  async getAssignments(filters: {
    driverId?: string;
    bookingId?: string;
    page?: string;
    limit?: string;
  }) {
    const { driverId, bookingId, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: Prisma.DriverAssignmentWhereInput = {};
    if (driverId) where.driverId = driverId;
    if (bookingId) where.bookingId = bookingId;

    const [data, total] = await Promise.all([
      this.prisma.driverAssignment.findMany({
        where,
        skip,
        take,
        orderBy: { assignmentTimestamp: 'desc' },
      }),
      this.prisma.driverAssignment.count({ where }),
    ]);

    const driverIds = [...new Set(data.map((a) => a.driverId))];
    const bookingIds = [...new Set(data.map((a) => a.bookingId))];
    const vehicleIds = [...new Set(data.map((a) => a.vehicleId))];

    const [drivers, bookings, vehicles] = await Promise.all([
      this.prisma.driver.findMany({
        where: { id: { in: driverIds } },
        select: {
          id: true,
          driverName: true,
          driverId: true,
          phone: true,
          status: true,
        },
      }),
      this.prisma.booking.findMany({
        where: { id: { in: bookingIds } },
        select: {
          id: true,
          reference: true,
          passengerCount: true,
          status: true,
          startDate: true,
        },
      }),
      this.prisma.transportationVehicle.findMany({
        where: { id: { in: vehicleIds } },
        select: {
          id: true,
          name: true,
          vehicleType: true,
          capacity: true,
          licensePlate: true,
        },
      }),
    ]);

    const driverMap = new Map(drivers.map((d) => [d.id, d]));
    const bookingMap = new Map(bookings.map((b) => [b.id, b]));
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

    const dataWithRelations = data.map((a) => ({
      ...a,
      driver: driverMap.get(a.driverId) || null,
      booking: bookingMap.get(a.bookingId) || null,
      vehicle: vehicleMap.get(a.vehicleId) || null,
    }));

    return {
      data: dataWithRelations,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async assignDriver(dto: {
    driverId: string;
    bookingId: string;
    vehicleId: string;
  }) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: dto.driverId },
    });

    if (!driver) {
      throw new NotFoundException(`Driver with id ${dto.driverId} not found`);
    }

    if (driver.status !== DriverStatus.AVAILABLE) {
      throw new ConflictException(
        `Driver is not available for assignment (current status: ${driver.status})`,
      );
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with id ${dto.bookingId} not found`);
    }

    const vehicle = await this.prisma.transportationVehicle.findUnique({
      where: { id: dto.vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with id ${dto.vehicleId} not found`);
    }

    if (vehicle.capacity < booking.passengerCount) {
      throw new ConflictException(
        `Vehicle capacity (${vehicle.capacity}) is less than booking passenger count (${booking.passengerCount})`,
      );
    }

    const inMaintenance = await this.prisma.vehicleMaintenance.findFirst({
      where: {
        vehicleId: dto.vehicleId,
        status: { in: ['SCHEDULED', 'IN_MAINTENANCE'] },
      },
    });

    if (inMaintenance) {
      throw new ConflictException(
        `Vehicle is currently in maintenance (${inMaintenance.status})`,
      );
    }

    const assignment = await this.prisma.driverAssignment.create({
      data: {
        driverId: dto.driverId,
        bookingId: dto.bookingId,
        vehicleId: dto.vehicleId,
        status: AssignmentStatus.PENDING,
      },
    });

    await this.prisma.driver.update({
      where: { id: dto.driverId },
      data: { status: DriverStatus.BUSY, lastStatusUpdate: new Date() },
    });

    await this.publishAssignmentEvent({
      event: 'DRIVER_ASSIGNED',
      assignmentId: assignment.id,
      driverId: dto.driverId,
      bookingId: dto.bookingId,
      vehicleId: dto.vehicleId,
      timestamp: new Date().toISOString(),
    });

    // Send Telegram notification to driver
    try {
      await this.telegramService.sendAssignmentNotification(assignment.id);
      await this.telegramService.queueAssignmentTimeout(assignment.id);
    } catch (error) {
      this.logger.warn(
        `Failed to send Telegram notification for assignment ${assignment.id}: ${(error as Error).message}`,
      );
    }

    return assignment;
  }

  async completeAssignment(id: string) {
    const existing = await this.prisma.driverAssignment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Assignment with id ${id} not found`);
    }

    if (existing.status === AssignmentStatus.COMPLETED) {
      throw new ConflictException('Assignment is already completed');
    }

    const assignment = await this.prisma.driverAssignment.update({
      where: { id },
      data: {
        status: AssignmentStatus.COMPLETED,
        completionTimestamp: new Date(),
      },
    });

    await this.prisma.driver.update({
      where: { id: assignment.driverId },
      data: { status: DriverStatus.AVAILABLE, lastStatusUpdate: new Date() },
    });

    await this.publishAssignmentEvent({
      event: 'ASSIGNMENT_COMPLETED',
      assignmentId: assignment.id,
      driverId: assignment.driverId,
      bookingId: assignment.bookingId,
      vehicleId: assignment.vehicleId,
      timestamp: new Date().toISOString(),
    });

    return assignment;
  }

  private async publishAssignmentEvent(
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.redis
        .getClient()
        .publish('driver_assignments', JSON.stringify(payload));
      this.logger.debug('Published assignment event', {
        event: String(payload.event),
      });
    } catch (error) {
      this.logger.warn(`Redis publish failed: ${(error as Error).message}`);
    }
  }

  async createAuditLog(params: {
    userId?: string;
    eventType: AuditEventType;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          eventType: params.eventType,
          entityType: params.entityType,
          entityId: params.entityId || null,
          metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Audit log creation failed: ${(error as Error).message}`,
      );
    }
  }
}
