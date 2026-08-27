import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SessionService } from '../services/session.service';
import { DriverStatus, AssignmentStatus } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import { parseDriverLocation } from '../types/driver-location.type';

export interface CommandResponse {
  text: string;
  keyboard?: {
    inlineKeyboard: Array<Array<{ text: string; callbackData: string }>>;
  };
  parseMode?: 'HTML';
}

@Injectable()
export class CommandHandler {
  private readonly logger = new Logger(CommandHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sessionService: SessionService,
  ) {}

  async handleCommand(
    telegramId: string,
    command: string,
  ): Promise<CommandResponse> {
    const cleanCommand = command.toLowerCase().trim();

    switch (cleanCommand) {
      case '/start':
        return this.handleStart(telegramId);
      case '/online':
        return this.handleOnline(telegramId);
      case '/offline':
        return this.handleOffline(telegramId);
      case '/status':
        return this.handleStatus(telegramId);
      case '/mytrip':
        return this.handleMyTrip(telegramId);
      case '/history':
        return this.handleHistory(telegramId);
      case '/earnings':
        return this.handleEarnings(telegramId);
      case '/emergency':
        return this.handleEmergency(telegramId);
      case '/support':
        return this.handleSupport(telegramId);
      case '/language':
        return this.handleLanguage();
      case '/location':
        return this.handleLocation(telegramId);
      case '/help':
        return this.handleHelp();
      default:
        return {
          text: 'Unknown command. Use /help to see available commands.',
        };
    }
  }

  private async handleStart(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return {
        text:
          'Welcome to DerLg Driver Bot!\n\n' +
          'To get started, please provide your credentials in this format:\n\n' +
          'driver_id: YOUR_ID\npin: YOUR_PIN\n\n' +
          'Example:\ndriver_id: DRV001\npin: 1234\n\n' +
          'Your Fleet Manager will provide these credentials.',
      };
    }

    const vehicle = driver.vehicleId
      ? await this.prisma.transportationVehicle.findUnique({
          where: { id: driver.vehicleId },
          select: { name: true },
        })
      : null;

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

    return {
      text:
        `Welcome back, ${driver.driverName}!\n\n` +
        `${statusEmoji} Status: ${driver.status}\n` +
        `Vehicle: ${vehicle?.name || 'Not assigned'}\n` +
        `Last update: ${lastUpdate}\n\n` +
        `Use the buttons below or type a command:`,
      keyboard: {
        inlineKeyboard: [
          [
            { text: '🟢 Go Online', callbackData: 'status:online' },
            { text: '🔴 Go Offline', callbackData: 'status:offline' },
          ],
          [
            { text: '📊 View Status', callbackData: 'status:view' },
            { text: '🚗 My Trip', callbackData: 'trip:view' },
          ],
          [
            { text: '📜 History', callbackData: 'history:view' },
            { text: '❓ Help', callbackData: 'help' },
          ],
        ],
      },
    };
  }

  private async handleOnline(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    await this.prisma.driver.update({
      where: { id: driver.id },
      data: {
        status: DriverStatus.AVAILABLE,
        lastStatusUpdate: new Date(),
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

    return {
      text:
        'You are now ONLINE\n\n' +
        'You are available for trip assignments. We will notify you when a trip is assigned.',
      keyboard: {
        inlineKeyboard: [
          [{ text: '🔴 Go Offline', callbackData: 'status:offline' }],
          [{ text: '📊 View Status', callbackData: 'status:view' }],
        ],
      },
    };
  }

  private async handleOffline(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    const activeAssignments = await this.prisma.driverAssignment.count({
      where: {
        driverId: driver.id,
        status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
      },
    });

    if (activeAssignments > 0) {
      return {
        text:
          'Cannot go offline\n\n' +
          'You have an active trip in progress. Please complete the trip first.',
        keyboard: {
          inlineKeyboard: [
            [{ text: '🚗 View Trip Details', callbackData: 'trip:view' }],
          ],
        },
      };
    }

    await this.prisma.driver.update({
      where: { id: driver.id },
      data: {
        status: DriverStatus.OFFLINE,
        lastStatusUpdate: new Date(),
        lastTelegramActivity: new Date(),
      },
    });

    await this.redis.getClient().publish(
      `driver_status_changed:${driver.id}`,
      JSON.stringify({
        driverId: driver.id,
        status: DriverStatus.OFFLINE,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      text:
        'You are now OFFLINE\n\n' +
        "You won't receive trip assignments. Tap below when ready to work:",
      keyboard: {
        inlineKeyboard: [
          [{ text: '🟢 Go Online', callbackData: 'status:online' }],
        ],
      },
    };
  }

  private async handleStatus(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    const vehicle = driver.vehicleId
      ? await this.prisma.transportationVehicle.findUnique({
          where: { id: driver.vehicleId },
          select: { name: true },
        })
      : null;

    const activeAssignment = await this.prisma.driverAssignment.findFirst({
      where: {
        driverId: driver.id,
        status: { in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] },
      },
      orderBy: { assignmentTimestamp: 'desc' },
    });

    const activeBooking = activeAssignment?.bookingId
      ? await this.prisma.booking.findUnique({
          where: { id: activeAssignment.bookingId },
          select: { reference: true },
        })
      : null;

    const statusEmoji =
      driver.status === 'AVAILABLE'
        ? '🟢'
        : driver.status === 'BUSY'
          ? '🔴'
          : '⚪';

    const lastUpdate = driver.lastStatusUpdate
      ? formatDistanceToNow(new Date(driver.lastStatusUpdate), {
          addSuffix: true,
        })
      : 'never';

    let text =
      `Your Status\n\n` +
      `${statusEmoji} Status: ${driver.status}\n` +
      `Vehicle: ${vehicle?.name || 'Not assigned'}\n` +
      `Last update: ${lastUpdate}\n`;

    if (activeBooking) {
      text += `\nActive trip: ${activeBooking.reference || 'N/A'}`;
    }

    const buttons: Array<Array<{ text: string; callbackData: string }>> = [];

    if (driver.status !== DriverStatus.AVAILABLE) {
      buttons.push([{ text: '🟢 Go Online', callbackData: 'status:online' }]);
    }

    if (driver.status !== DriverStatus.OFFLINE) {
      buttons.push([{ text: '🔴 Go Offline', callbackData: 'status:offline' }]);
    }

    buttons.push([
      { text: '🚗 My Trip', callbackData: 'trip:view' },
      { text: '📜 History', callbackData: 'history:view' },
    ]);

    return { text, keyboard: { inlineKeyboard: buttons } };
  }

  private async handleMyTrip(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

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
        text:
          `No active trips\n\n` +
          `Status: ${driver.status}\n` +
          (isOffline
            ? 'You are currently offline. Go online to receive assignments.'
            : 'You have no active assignments at the moment.'),
        keyboard: {
          inlineKeyboard: isOffline
            ? [[{ text: '🟢 Go Online', callbackData: 'status:online' }]]
            : [[{ text: '📊 View Status', callbackData: 'status:view' }]],
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
        `Customer phone: ${booking?.user?.phone || 'N/A'}`,
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
            { text: '📞 Contact Support', callbackData: 'support:contact' },
            { text: '🚨 Emergency', callbackData: 'emergency:alert' },
          ],
        ],
      },
    };
  }

  private async handleHistory(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    const assignments = await this.prisma.driverAssignment.findMany({
      where: {
        driverId: driver.id,
        status: AssignmentStatus.COMPLETED,
      },
      orderBy: { completionTimestamp: 'desc' },
      take: 10,
    });

    if (assignments.length === 0) {
      return {
        text: 'No trip history\n\nYou have not completed any trips yet.',
      };
    }

    const bookingIds = assignments.map((a) => a.bookingId).filter(Boolean);
    const bookings = bookingIds.length
      ? await this.prisma.booking.findMany({
          where: { id: { in: bookingIds } },
          select: { id: true, reference: true },
        })
      : [];
    const bookingMap = new Map(bookings.map((b) => [b.id, b]));

    const lines = assignments.map((a, i) => {
      const date = a.completionTimestamp
        ? new Date(a.completionTimestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        : 'N/A';
      const ref = bookingMap.get(a.bookingId)?.reference;
      return `${i + 1}. ${date} — ${ref || a.id.slice(0, 8)}`;
    });

    return {
      text: `Trip History (last ${assignments.length})\n\n${lines.join('\n')}`,
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

  private async handleEarnings(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [todayCount, weekCount, monthCount] = await Promise.all([
      this.prisma.driverAssignment.count({
        where: {
          driverId: driver.id,
          status: AssignmentStatus.COMPLETED,
          completionTimestamp: { gte: today },
        },
      }),
      this.prisma.driverAssignment.count({
        where: {
          driverId: driver.id,
          status: AssignmentStatus.COMPLETED,
          completionTimestamp: { gte: weekAgo },
        },
      }),
      this.prisma.driverAssignment.count({
        where: {
          driverId: driver.id,
          status: AssignmentStatus.COMPLETED,
          completionTimestamp: { gte: monthAgo },
        },
      }),
    ]);

    return {
      text:
        `Earnings Summary\n\n` +
        `Today: ${todayCount} trips\n` +
        `This Week: ${weekCount} trips\n` +
        `This Month: ${monthCount} trips`,
    };
  }

  private async handleEmergency(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    return {
      text:
        'Emergency Alert\n\n' +
        'Tap the button below to send an emergency alert to dispatch. They will contact you immediately.\n\n' +
        'Emergency Contacts:\n' +
        'Police: 117\n' +
        'Ambulance: 119\n' +
        'Tourist Police: 012 942 484',
      keyboard: {
        inlineKeyboard: [
          [
            {
              text: '🚨 SEND EMERGENCY ALERT',
              callbackData: 'emergency:alert',
            },
          ],
        ],
      },
    };
  }

  private async handleSupport(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    await this.sessionService.setSession(telegramId, 'support_request');

    return {
      text:
        'Support Request\n\n' +
        'Please describe your issue or question. Type your message and we will create a support ticket for you.',
    };
  }

  private handleLanguage(): CommandResponse {
    return {
      text: 'Select Language\n\nChoose your preferred language:',
      keyboard: {
        inlineKeyboard: [
          [{ text: '🇰🇭 ខ្មែរ (Khmer)', callbackData: 'lang:km' }],
          [{ text: '🇬🇧 English', callbackData: 'lang:en' }],
          [{ text: '🇨🇳 中文 (Chinese)', callbackData: 'lang:zh' }],
        ],
      },
    };
  }

  private async handleLocation(telegramId: string): Promise<CommandResponse> {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'You are not registered. Use /start first.' };
    }

    const locationData = await this.redis
      .getClient()
      .get(`driver_location:${driver.id}`);

    const loc = parseDriverLocation(locationData);
    if (loc) {
      const time = loc.timestamp
        ? formatDistanceToNow(new Date(loc.timestamp), { addSuffix: true })
        : 'recently';

      return {
        text:
          `Your Location\n\n` +
          `Lat: ${loc.latitude}\n` +
          `Lng: ${loc.longitude}\n` +
          `Updated: ${time}`,
      };
    }

    return {
      text:
        'Location Sharing\n\n' +
        'You are not currently sharing your location. Share your live location during trips so dispatch can track your progress.',
      keyboard: {
        inlineKeyboard: [
          [{ text: '📍 Share Location', callbackData: 'location:share' }],
        ],
      },
    };
  }

  private handleHelp(): CommandResponse {
    return {
      text:
        'Available Commands\n\n' +
        '/online — Go online and receive assignments\n' +
        '/offline — Go offline\n' +
        '/status — Check your current status\n' +
        '/mytrip — View active trip details\n' +
        '/history — View completed trips\n' +
        '/earnings — View earnings summary\n' +
        '/location — View or share location\n' +
        '/emergency — Send emergency alert\n' +
        '/support — Create support ticket\n' +
        '/language — Change language\n' +
        '/help — Show this help message',
    };
  }
}
