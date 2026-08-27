import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SessionService } from '../services/session.service';
import { AssignmentStatus, DriverStatus } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import { CommandResponse } from './command.handler';
import { parseDriverLocation } from '../types/driver-location.type';

@Injectable()
export class CallbackHandler {
  private readonly logger = new Logger(CallbackHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sessionService: SessionService,
  ) {}

  async handleCallback(
    telegramId: string,
    data: string,
  ): Promise<CommandResponse> {
    const parts = data.split(':');
    const action = parts[0];
    const subAction = parts[1];
    const id = parts[2];

    switch (action) {
      case 'status':
        return this.handleStatusCallback(telegramId, subAction);
      case 'trip':
        return this.handleTripCallback(telegramId, subAction, id);
      case 'assignment':
        return this.handleAssignmentCallback(telegramId, subAction, id);
      case 'history':
        return this.handleHistoryCallback(telegramId, subAction);
      case 'location':
        return this.handleLocationCallback(telegramId, subAction);
      case 'support':
        return this.handleSupportCallback(telegramId, subAction);
      case 'emergency':
        return this.handleEmergencyCallback(telegramId, subAction);
      case 'lang':
        return this.handleLanguageCallback(telegramId, subAction);
      case 'help':
        return this.handleHelpCallback();
      default:
        return { text: 'Unknown action.' };
    }
  }

  // ─── Status callbacks ───

  private async handleStatusCallback(
    telegramId: string,
    subAction: string,
  ): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered.' };
    }

    const vehicle = driver.vehicleId
      ? await this.prisma.transportationVehicle.findUnique({
          where: { id: driver.vehicleId },
          select: { name: true },
        })
      : null;

    if (subAction === 'view') {
      const lastUpdate = driver.lastStatusUpdate
        ? formatDistanceToNow(new Date(driver.lastStatusUpdate), {
            addSuffix: true,
          })
        : 'never';

      const statusEmoji =
        driver.status === 'AVAILABLE'
          ? '🟢'
          : driver.status === 'BUSY'
            ? '🔴'
            : '⚪';

      const buttons: Array<Array<{ text: string; callbackData: string }>> = [];

      if (driver.status !== DriverStatus.AVAILABLE) {
        buttons.push([{ text: '🟢 Go Online', callbackData: 'status:online' }]);
      }

      if (driver.status !== DriverStatus.OFFLINE) {
        buttons.push([
          { text: '🔴 Go Offline', callbackData: 'status:offline' },
        ]);
      }

      buttons.push([
        { text: '🚗 My Trip', callbackData: 'trip:view' },
        { text: '📜 History', callbackData: 'history:view' },
      ]);

      return {
        text:
          `${statusEmoji} Status: ${driver.status}\n` +
          `Vehicle: ${vehicle?.name || 'Not assigned'}\n` +
          `Last update: ${lastUpdate}`,
        keyboard: { inlineKeyboard: buttons },
      };
    }

    // online or offline
    const newStatus =
      subAction === 'online' ? DriverStatus.AVAILABLE : DriverStatus.OFFLINE;

    if (newStatus === DriverStatus.OFFLINE) {
      const activeAssignments = await this.prisma.driverAssignment.count({
        where: {
          driverId: driver.id,
          status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
        },
      });

      if (activeAssignments > 0) {
        return {
          text: 'Cannot go offline. You have an active trip. Complete it first.',
          keyboard: {
            inlineKeyboard: [
              [{ text: '🚗 View Trip', callbackData: 'trip:view' }],
            ],
          },
        };
      }
    }

    await this.prisma.driver.update({
      where: { id: driver.id },
      data: {
        status: newStatus,
        lastStatusUpdate: new Date(),
        lastTelegramActivity: new Date(),
      },
    });

    await this.redis.getClient().publish(
      `driver_status_changed:${driver.id}`,
      JSON.stringify({
        driverId: driver.id,
        status: newStatus,
        timestamp: new Date().toISOString(),
      }),
    );

    const isOnline = newStatus === DriverStatus.AVAILABLE;
    return {
      text: isOnline
        ? 'You are now ONLINE and available for trips.'
        : 'You are now OFFLINE.',
      keyboard: {
        inlineKeyboard: isOnline
          ? [[{ text: '🔴 Go Offline', callbackData: 'status:offline' }]]
          : [[{ text: '🟢 Go Online', callbackData: 'status:online' }]],
      },
    };
  }

  // ─── Trip callbacks ───

  private async handleTripCallback(
    telegramId: string,
    subAction: string,
    assignmentId?: string,
  ): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'Driver not registered.' };
    }

    if (subAction === 'view') {
      const assignment = await this.prisma.driverAssignment.findFirst({
        where: {
          driverId: driver.id,
          status: AssignmentStatus.ACCEPTED,
        },
        orderBy: { assignmentTimestamp: 'desc' },
      });

      if (!assignment) {
        const isOffline = driver.status === DriverStatus.OFFLINE;
        return {
          text: isOffline
            ? 'No active trips. You are offline.'
            : 'No active trips.',
          keyboard: {
            inlineKeyboard: isOffline
              ? [[{ text: '🟢 Go Online', callbackData: 'status:online' }]]
              : [[{ text: '📊 Status', callbackData: 'status:view' }]],
          },
        };
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

      return {
        text:
          `Active Trip\n\n` +
          `Booking: ${booking?.reference || 'N/A'}\n` +
          `Customer: ${booking?.user?.fullName || 'N/A'}\n` +
          `Passengers: ${booking?.passengerCount || 1}\n` +
          `Pickup: ${pickupTime}\n` +
          `Total: $${Number(booking?.totalUsd ?? 0).toFixed(2)}\n\n` +
          `Phone: ${booking?.user?.phone || 'N/A'}`,
        keyboard: {
          inlineKeyboard: [
            [
              {
                text: '🚀 Start Trip',
                callbackData: `trip:start:${assignment.id}`,
              },
              {
                text: '✅ Complete Trip',
                callbackData: `trip:complete:${assignment.id}`,
              },
            ],
            [
              {
                text: '📞 Contact Support',
                callbackData: 'support:contact',
              },
              { text: '🚨 Emergency', callbackData: 'emergency:alert' },
            ],
          ],
        },
      };
    }

    if (subAction === 'start' && assignmentId) {
      await this.prisma.driverAssignment.update({
        where: { id: assignmentId, driverId: driver.id },
        data: {
          status: AssignmentStatus.ACCEPTED,
          tripStartTime: new Date(),
        },
      });

      await this.prisma.driver.update({
        where: { id: driver.id },
        data: { status: DriverStatus.BUSY, lastTelegramActivity: new Date() },
      });

      await this.redis.getClient().publish(
        `driver_status_changed:${driver.id}`,
        JSON.stringify({
          driverId: driver.id,
          status: DriverStatus.BUSY,
          timestamp: new Date().toISOString(),
        }),
      );

      return {
        text:
          'Trip started. Drive safely!\n\n' +
          'Share your live location for this trip?',
        keyboard: {
          inlineKeyboard: [
            [
              { text: '📍 Share Location', callbackData: 'location:share' },
              { text: '⏭️ Skip', callbackData: 'location:skip' },
            ],
            [
              {
                text: '✅ Complete Trip',
                callbackData: `trip:complete:${assignmentId}`,
              },
            ],
            [{ text: '🚨 Emergency', callbackData: 'emergency:alert' }],
          ],
        },
      };
    }

    if (subAction === 'complete' && assignmentId) {
      const assignment = await this.prisma.driverAssignment.update({
        where: { id: assignmentId, driverId: driver.id },
        data: {
          status: AssignmentStatus.COMPLETED,
          completionTimestamp: new Date(),
        },
      });

      await this.prisma.driver.update({
        where: { id: driver.id },
        data: {
          status: DriverStatus.AVAILABLE,
          lastTelegramActivity: new Date(),
        },
      });

      await this.redis.getClient().publish(
        `driver_status_changed:${driver.id}`,
        JSON.stringify({
          driverId: driver.id,
          status: DriverStatus.AVAILABLE,
          timestamp: new Date().toISOString(),
        }),
      );

      const duration =
        assignment.tripStartTime && assignment.completionTimestamp
          ? Math.round(
              (assignment.completionTimestamp.getTime() -
                assignment.tripStartTime.getTime()) /
                60000,
            )
          : null;

      return {
        text:
          'Trip completed! You are now available for new assignments.' +
          (duration ? `\n\nDuration: ${duration} min` : ''),
        keyboard: {
          inlineKeyboard: [
            [
              { text: '📜 View History', callbackData: 'history:view' },
              { text: '🔴 Go Offline', callbackData: 'status:offline' },
            ],
          ],
        },
      };
    }

    return { text: 'Invalid trip action.' };
  }

  // ─── Assignment callbacks ───

  private async handleAssignmentCallback(
    telegramId: string,
    subAction: string,
    assignmentId?: string,
  ): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'Driver not registered.' };
    }

    if (!assignmentId) {
      return { text: 'Invalid assignment.' };
    }

    if (subAction === 'accept') {
      const assignment = await this.prisma.driverAssignment.update({
        where: { id: assignmentId, driverId: driver.id },
        data: {
          status: AssignmentStatus.ACCEPTED,
          responseTimestamp: new Date(),
        },
      });

      await this.prisma.driver.update({
        where: { id: driver.id },
        data: { status: DriverStatus.BUSY, lastTelegramActivity: new Date() },
      });

      await this.redis.getClient().publish(
        `driver_status_changed:${driver.id}`,
        JSON.stringify({
          driverId: driver.id,
          status: DriverStatus.BUSY,
          timestamp: new Date().toISOString(),
        }),
      );

      await this.redis.getClient().publish(
        'driver_assignments',
        JSON.stringify({
          event: 'ASSIGNMENT_ACCEPTED',
          assignmentId: assignment.id,
          driverId: driver.id,
          timestamp: new Date().toISOString(),
        }),
      );

      return {
        text:
          'Trip accepted. Customer has been notified.\n\n' +
          'Pickup at the scheduled location and time.',
        keyboard: {
          inlineKeyboard: [
            [
              {
                text: '🚀 Start Trip',
                callbackData: `trip:start:${assignmentId}`,
              },
            ],
            [
              {
                text: '📞 Contact Support',
                callbackData: 'support:contact',
              },
            ],
          ],
        },
      };
    }

    if (subAction === 'reject') {
      const assignment = await this.prisma.driverAssignment.update({
        where: { id: assignmentId, driverId: driver.id },
        data: {
          status: AssignmentStatus.REJECTED,
          responseTimestamp: new Date(),
          rejectionReason: 'Rejected by driver via Telegram',
        },
      });

      await this.prisma.driver.update({
        where: { id: driver.id },
        data: {
          status: DriverStatus.AVAILABLE,
          lastTelegramActivity: new Date(),
        },
      });

      await this.redis.getClient().publish(
        `driver_status_changed:${driver.id}`,
        JSON.stringify({
          driverId: driver.id,
          status: DriverStatus.AVAILABLE,
          timestamp: new Date().toISOString(),
        }),
      );

      await this.redis.getClient().publish(
        'driver_assignments',
        JSON.stringify({
          event: 'ASSIGNMENT_REJECTED',
          assignmentId: assignment.id,
          driverId: driver.id,
          timestamp: new Date().toISOString(),
        }),
      );

      return {
        text: 'Trip rejected. Dispatch has been notified.',
        keyboard: {
          inlineKeyboard: [
            [{ text: '📊 View Status', callbackData: 'status:view' }],
          ],
        },
      };
    }

    return { text: 'Invalid assignment action.' };
  }

  // ─── History callbacks ───

  private async handleHistoryCallback(
    telegramId: string,
    subAction: string,
  ): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'Driver not registered.' };
    }

    const now = new Date();
    let fromDate: Date;

    switch (subAction) {
      case 'today':
        fromDate = new Date(now);
        fromDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        fromDate = new Date(now);
        fromDate.setDate(fromDate.getDate() - 7);
        break;
      case 'month':
        fromDate = new Date(now);
        fromDate.setDate(fromDate.getDate() - 30);
        break;
      default:
        fromDate = new Date(now);
        fromDate.setDate(fromDate.getDate() - 7);
    }

    const count = await this.prisma.driverAssignment.count({
      where: {
        driverId: driver.id,
        status: AssignmentStatus.COMPLETED,
        completionTimestamp: { gte: fromDate },
      },
    });

    const label =
      subAction === 'today'
        ? 'Today'
        : subAction === 'week'
          ? 'This Week'
          : 'This Month';

    return {
      text: `${label} Summary\n\nCompleted trips: ${count}`,
      keyboard: {
        inlineKeyboard: [
          [
            { text: '📅 Today', callbackData: 'history:today' },
            { text: '📆 This Week', callbackData: 'history:week' },
            { text: '🗓️ This Month', callbackData: 'history:month' },
          ],
        ],
      },
    };
  }

  // ─── Location callbacks ───

  private handleLocationCallback(
    telegramId: string,
    subAction: string,
  ): CommandResponse {
    if (subAction === 'share') {
      return {
        text:
          'To share your live location:\n\n' +
          '1. Tap the attachment icon (📎)\n' +
          '2. Select Location\n' +
          '3. Choose Live Location\n\n' +
          'Your location will update automatically every 60 seconds.',
      };
    }

    if (subAction === 'skip') {
      return {
        text: 'Location sharing skipped. You can share later from /location.',
      };
    }

    return { text: 'Invalid location action.' };
  }

  // ─── Support callbacks ───

  private async handleSupportCallback(
    telegramId: string,
    subAction: string,
  ): Promise<CommandResponse> {
    if (subAction === 'contact') {
      await this.sessionService.setSession(telegramId, 'support_request');
      return {
        text:
          'Support Request\n\n' +
          'Please describe your issue or question. Type your message and we will create a support ticket for you.',
      };
    }

    return { text: 'Invalid support action.' };
  }

  // ─── Emergency callbacks ───

  private async handleEmergencyCallback(
    telegramId: string,
    subAction: string,
  ): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'Driver not registered.' };
    }

    if (subAction === 'alert') {
      const locationData = await this.redis
        .getClient()
        .get(`driver_location:${driver.id}`);
      let lat: number | undefined;
      let lng: number | undefined;

      const loc = parseDriverLocation(locationData);
      if (loc) {
        lat = loc.latitude;
        lng = loc.longitude;
      }

      const systemUser = await this.prisma.user.findFirst({
        select: { id: true },
      });

      const alert = await this.prisma.emergencyAlert.create({
        data: {
          userId: systemUser?.id || '00000000-0000-0000-0000-000000000000',
          alertType: 'sos',
          status: 'triggered',
          latitude: lat ?? 0,
          longitude: lng ?? 0,
          driverId: driver.id,
          notes: `Emergency alert from driver ${driver.driverName} via Telegram`,
        },
      });

      await this.redis.getClient().publish(
        'emergency_alerts',
        JSON.stringify({
          event: 'DRIVER_EMERGENCY',
          alertId: alert.id,
          driverId: driver.id,
          driverName: driver.driverName,
          lat,
          lng,
          timestamp: new Date().toISOString(),
        }),
      );

      return {
        text:
          'Emergency alert sent to dispatch. They will contact you immediately. Stay safe!\n\n' +
          'Emergency Contacts:\n' +
          'Police: 117\n' +
          'Ambulance: 119\n' +
          'Tourist Police: 012 942 484',
      };
    }

    return { text: 'Invalid emergency action.' };
  }

  // ─── Language callbacks ───

  private async handleLanguageCallback(
    telegramId: string,
    lang: string,
  ): Promise<CommandResponse> {
    await this.sessionService.setLanguage(telegramId, lang);

    const labels: Record<string, string> = {
      en: 'English',
      km: 'Khmer',
      zh: 'Chinese',
    };

    return {
      text: `Language changed to ${labels[lang] || lang}.`,
    };
  }

  // ─── Help callback ───

  private handleHelpCallback(): CommandResponse {
    return {
      text:
        'Available Commands\n\n' +
        '/online — Go online\n' +
        '/offline — Go offline\n' +
        '/status — Check status\n' +
        '/mytrip — Active trip\n' +
        '/history — Trip history\n' +
        '/earnings — Earnings\n' +
        '/location — Location\n' +
        '/emergency — Emergency alert\n' +
        '/support — Support ticket\n' +
        '/language — Change language\n' +
        '/help — This help',
    };
  }
}
