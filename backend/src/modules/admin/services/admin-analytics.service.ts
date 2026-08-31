import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditEventType, Prisma } from '@prisma/client';

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenueAnalytics(filters: { startDate?: string; endDate?: string }) {
    // Revenue is attributed to booking lines that OVERLAP the reporting window.
    // `booking_items.date` no longer exists — it became a startDate/endDate pair
    // — and matching a single date also excluded every multi-night stay whose
    // start fell before the window.
    const where: Prisma.BookingItemWhereInput = {
      booking: { deletedAt: null },
    };
    if (filters.endDate) {
      where.startDate = { lte: new Date(filters.endDate) };
    }
    if (filters.startDate) {
      where.endDate = { gte: new Date(filters.startDate) };
    }

    const byType = await this.prisma.bookingItem.groupBy({
      by: ['bookingType'],
      where,
      _sum: { subtotalUsd: true },
      _count: { _all: true },
    });

    const total = await this.prisma.bookingItem.aggregate({
      where,
      _sum: { subtotalUsd: true },
      _count: { _all: true },
    });

    return {
      byType: byType.map((item) => ({
        bookingType: item.bookingType,
        revenueUsd: Number(item._sum.subtotalUsd || 0),
        count: item._count._all,
      })),
      totalRevenueUsd: Number(total._sum.subtotalUsd || 0),
      totalBookings: total._count._all,
      period: {
        startDate: filters.startDate || null,
        endDate: filters.endDate || null,
      },
    };
  }

  async getBookingStatistics() {
    const byStatus = await this.prisma.booking.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const total = await this.prisma.booking.count();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [bookingsToday, bookingsThisWeek, bookingsThisMonth] =
      await Promise.all([
        this.prisma.booking.count({ where: { createdAt: { gte: today } } }),
        this.prisma.booking.count({
          where: { createdAt: { gte: weekAgo } },
        }),
        this.prisma.booking.count({
          where: { createdAt: { gte: monthAgo } },
        }),
      ]);

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      total,
      today: bookingsToday,
      thisWeek: bookingsThisWeek,
      thisMonth: bookingsThisMonth,
    };
  }

  async getDriverPerformance() {
    const drivers = await this.prisma.driver.findMany({
      select: {
        id: true,
        driverName: true,
        driverId: true,
        status: true,
        _count: {
          select: { assignments: true },
        },
      },
    });

    const completedAssignments = await this.prisma.driverAssignment.groupBy({
      by: ['driverId'],
      where: { status: 'COMPLETED' },
      _count: { _all: true },
    });

    const completionMap = new Map(
      completedAssignments.map((a) => [a.driverId, a._count._all]),
    );

    return drivers.map((d) => ({
      driverId: d.id,
      driverName: d.driverName,
      driverCode: d.driverId,
      status: d.status,
      totalAssignments: d._count.assignments,
      completedTrips: completionMap.get(d.id) || 0,
    }));
  }

  async getPopularDestinations() {
    const tripBookings = await this.prisma.bookingItem.groupBy({
      by: ['tripId'],
      where: { bookingType: 'trip_package', tripId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { tripId: 'desc' } },
      take: 10,
    });

    const tripIds = tripBookings
      .map((t) => t.tripId)
      .filter((id): id is string => id !== null);

    const trips = await this.prisma.trip.findMany({
      where: { id: { in: tripIds } },
      include: {
        translations: { where: { language: 'en' } },
      },
    });

    const tripMap = new Map(trips.map((t) => [t.id, t]));

    return tripBookings.map((tb) => {
      const trip = tb.tripId ? tripMap.get(tb.tripId) : undefined;
      return {
        tripId: tb.tripId,
        title: trip?.translations[0]?.title || 'Unknown',
        bookingCount: tb._count._all,
      };
    });
  }

  async getHotelOccupancy() {
    const totalRooms = await this.prisma.hotelRoom.count();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Room-nights occupied in the last 30 days.
    //
    // Counts booking lines that overlap the window rather than lines whose single
    // `date` fell inside it — that column no longer exists, and the old count
    // undercounted every multi-night stay.
    const occupied = await this.prisma.bookingItem.count({
      where: {
        bookingType: 'hotel_room',
        startDate: { lte: today },
        endDate: { gte: thirtyDaysAgo },
        booking: {
          deletedAt: null,
          status: {
            notIn: ['cancelled', 'expired', 'payment_failed', 'no_show'],
          },
        },
      },
    });

    const occupancyRate =
      totalRooms > 0 ? (occupied / (totalRooms * 30)) * 100 : 0;

    return {
      totalRooms: totalRooms,
      occupiedRoomNights30d: occupied,
      occupancyRatePercent: Math.round(occupancyRate * 100) / 100,
      periodDays: 30,
    };
  }

  async getGuideUtilization() {
    const totalGuides = await this.prisma.guide.count();

    const guidesWithBookings = await this.prisma.bookingItem.groupBy({
      by: ['guideId'],
      where: { guideId: { not: null } },
      _count: { _all: true },
    });

    const utilizationRate =
      totalGuides > 0 ? (guidesWithBookings.length / totalGuides) * 100 : 0;

    return {
      totalGuides: totalGuides,
      activeGuides: guidesWithBookings.length,
      utilizationRatePercent: Math.round(utilizationRate * 100) / 100,
    };
  }

  async getAIAssistedBookings() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [aiSessions, bookings] = await Promise.all([
      this.prisma.aIChatSession.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { userId: true, createdAt: true },
      }),
      this.prisma.booking.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { id: true, userId: true, createdAt: true, totalUsd: true },
      }),
    ]);

    const userSessionMap = new Map<string, Date[]>();
    for (const session of aiSessions) {
      // Guest sessions carry no user id, so they cannot be correlated to a
      // booking by user. Skip them rather than keying the map on null.
      if (session.userId === null) continue;
      if (!userSessionMap.has(session.userId)) {
        userSessionMap.set(session.userId, []);
      }
      userSessionMap.get(session.userId)!.push(session.createdAt);
    }

    const aiAssisted = bookings.filter((b) => {
      const sessions = userSessionMap.get(b.userId);
      if (!sessions) return false;
      return sessions.some((s) => {
        const diff = b.createdAt.getTime() - s.getTime();
        return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
      });
    });

    return {
      totalBookings30d: bookings.length,
      aiAssistedBookings: aiAssisted.length,
      aiAssistedRevenueUsd: Number(
        aiAssisted.reduce((sum, b) => sum + Number(b.totalUsd), 0),
      ),
      conversionRatePercent:
        bookings.length > 0
          ? Math.round((aiAssisted.length / bookings.length) * 10000) / 100
          : 0,
    };
  }

  async getAIPerformanceMetrics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const totalSessions = await this.prisma.aIChatSession.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    // A second copy of the raw query that was fixed in admin-ai-monitoring: it
    // selected `sessionId` (a Prisma field name) while grouping by `session_id`
    // (the real column), so Postgres would raise 42703 the moment the table held a
    // row. The table was empty until the chat archive started writing, which is
    // why it never surfaced. `groupBy` keeps the field/column mapping in Prisma's
    // hands and removes the hand-written SQL entirely.
    const messageCounts = await this.prisma.aIChatMessage.groupBy({
      by: ['sessionId'],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    });

    const avgMessagesPerSession =
      messageCounts.length > 0
        ? messageCounts.reduce((sum, row) => sum + row._count._all, 0) /
          messageCounts.length
        : 0;

    const aiAssisted = await this.getAIAssistedBookings();

    return {
      totalSessions30d: totalSessions,
      avgMessagesPerSession: Math.round(avgMessagesPerSession * 100) / 100,
      bookingsConverted: aiAssisted.aiAssistedBookings,
      conversionRatePercent: aiAssisted.conversionRatePercent,
    };
  }

  async exportData(params: {
    format: string;
    metric?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { format, metric, startDate, endDate } = params;

    let data: unknown[] = [];

    switch (metric) {
      case 'revenue':
        data = (await this.getRevenueAnalytics({ startDate, endDate })).byType;
        break;
      case 'bookings':
        data = (await this.getBookingStatistics()).byStatus;
        break;
      case 'drivers':
        data = await this.getDriverPerformance();
        break;
      case 'destinations':
        data = await this.getPopularDestinations();
        break;
      case 'hotels':
        data = [await this.getHotelOccupancy()];
        break;
      case 'guides':
        data = [await this.getGuideUtilization()];
        break;
      case 'ai':
        data = [await this.getAIPerformanceMetrics()];
        break;
      default:
        data = [
          {
            metric: 'revenue',
            data: (await this.getRevenueAnalytics({ startDate, endDate }))
              .byType,
          },
          {
            metric: 'bookings',
            data: (await this.getBookingStatistics()).byStatus,
          },
        ];
    }

    if (format === 'csv') {
      return {
        format: 'csv',
        content: this.toCsv(data as Array<Record<string, unknown>>),
      };
    }

    return { format: 'json', content: JSON.stringify(data, null, 2) };
  }

  /**
   * Serialises rows to CSV.
   *
   * Values are quoted whenever they contain a comma, quote or newline, with
   * embedded quotes doubled per RFC 4180. Without that, a hotel name like
   * "Angkor Grand, Siem Reap" silently shifts every later column in the row.
   */
  private toCsv(data: Array<Record<string, unknown>>): string {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);

    const escape = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const raw =
        typeof value === 'string'
          ? value
          : typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : value instanceof Date
              ? value.toISOString()
              : JSON.stringify(value);
      return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
    };

    const rows = data.map((row) =>
      headers.map((h) => escape(row[h])).join(','),
    );
    return [headers.map(escape).join(','), ...rows].join('\n');
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
    } catch {
      // Silently fail audit logging
    }
  }
}
