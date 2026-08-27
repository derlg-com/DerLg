import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class AdminAIMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private readonly SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

  private getDefaultDateRange(filters?: {
    startDate?: string;
    endDate?: string;
  }) {
    const endDate = filters?.endDate ? new Date(filters.endDate) : new Date();
    const startDate = filters?.startDate
      ? new Date(filters.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startDate, endDate };
  }

  private async getAISessionsInRange(startDate: Date, endDate: Date) {
    return this.prisma.aIChatSession.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { userId: true, createdAt: true, id: true },
    });
  }

  private async getBookingsInRange(startDate: Date, endDate: Date) {
    return this.prisma.booking.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        totalUsd: true,
        status: true,
        reference: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private buildUserSessionMap(sessions: { userId: string; createdAt: Date }[]) {
    const map = new Map<string, Date[]>();
    for (const session of sessions) {
      if (!map.has(session.userId)) {
        map.set(session.userId, []);
      }
      map.get(session.userId)!.push(session.createdAt);
    }
    return map;
  }

  private isAIAssisted(
    booking: { userId: string; createdAt: Date },
    userSessionMap: Map<string, Date[]>,
  ) {
    const sessions = userSessionMap.get(booking.userId);
    if (!sessions) return false;
    return sessions.some((s) => {
      const diff = booking.createdAt.getTime() - s.getTime();
      return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
    });
  }

  async getAIAssistedBookings(filters?: {
    startDate?: string;
    endDate?: string;
  }) {
    const { startDate, endDate } = this.getDefaultDateRange(filters);

    const [aiSessions, bookings] = await Promise.all([
      this.getAISessionsInRange(startDate, endDate),
      this.getBookingsInRange(startDate, endDate),
    ]);

    const userSessionMap = this.buildUserSessionMap(aiSessions);
    const aiAssisted = bookings.filter((b) =>
      this.isAIAssisted(b, userSessionMap),
    );

    return {
      totalBookings: bookings.length,
      aiAssistedBookings: aiAssisted.length,
      aiAssistedRevenueUsd: Number(
        aiAssisted.reduce((sum, b) => sum + Number(b.totalUsd), 0),
      ),
      bookings: aiAssisted.map((b) => ({
        id: b.id,
        reference: b.reference,
        userId: b.userId,
        status: b.status,
        totalUsd: Number(b.totalUsd),
        createdAt: b.createdAt,
      })),
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
  }

  async getAISessionDetails(sessionId: string) {
    // Try Redis first (7-day TTL)
    const redisKey = `ai:session:${sessionId}`;
    const cached = await this.redis.getClient().get(redisKey);

    if (cached) {
      // The cached payload is opaque to us — it is written by the Python agent —
      // so it is surfaced as an unknown record rather than pretending to a shape.
      return JSON.parse(cached) as Record<string, unknown>;
    }

    // Check if session exists in DB
    const session = await this.prisma.aIChatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            messageType: true,
            metadata: true,
            createdAt: true,
          },
        },
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    if (!session) {
      return null;
    }

    // Session exists in DB but Redis TTL expired
    return { expired: true, sessionId: sessionId };
  }

  async getAIBookingSuccessRate(filters?: {
    startDate?: string;
    endDate?: string;
  }) {
    const { startDate, endDate } = this.getDefaultDateRange(filters);

    const [aiSessions, bookings] = await Promise.all([
      this.getAISessionsInRange(startDate, endDate),
      this.getBookingsInRange(startDate, endDate),
    ]);

    const userSessionMap = this.buildUserSessionMap(aiSessions);
    const aiAssisted = bookings.filter((b) =>
      this.isAIAssisted(b, userSessionMap),
    );

    const total = aiAssisted.length;
    const successful = aiAssisted.filter((b) =>
      ['confirmed', 'completed'].includes(b.status),
    ).length;

    return {
      totalAiAssistedBookings: total,
      successfulBookings: successful,
      successRatePercent:
        total > 0 ? Math.round((successful / total) * 10000) / 100 : 0,
      byStatus: {
        // `reserved` was split by merge_booking_methods into `hold` (awaiting
        // payment) and `pending_payment` (Stripe PaymentIntent created). Both are
        // reported so the AI-assisted funnel still adds up to the total.
        hold: aiAssisted.filter((b) => b.status === 'hold').length,
        pendingPayment: aiAssisted.filter((b) => b.status === 'pending_payment')
          .length,
        confirmed: aiAssisted.filter((b) => b.status === 'confirmed').length,
        completed: aiAssisted.filter((b) => b.status === 'completed').length,
        cancelled: aiAssisted.filter((b) => b.status === 'cancelled').length,
        paymentFailed: aiAssisted.filter((b) => b.status === 'payment_failed')
          .length,
        expired: aiAssisted.filter((b) => b.status === 'expired').length,
        noShow: aiAssisted.filter((b) => b.status === 'no_show').length,
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
  }

  async getAIPerformanceMetrics(filters?: {
    startDate?: string;
    endDate?: string;
  }) {
    const { startDate, endDate } = this.getDefaultDateRange(filters);

    const totalSessions = await this.prisma.aIChatSession.count({
      where: { createdAt: { gte: startDate, lte: endDate } },
    });

    const avgMessagesPerSession = await this.prisma.$queryRaw<
      { avgMessages: number }[]
    >`
      SELECT AVG(msg_count)::float as avg_messages
      FROM (
        SELECT sessionId, COUNT(*) as msg_count
        FROM ai_chat_messages
        WHERE created_at >= ${startDate} AND created_at <= ${endDate}
        GROUP BY session_id
      ) sub
    `;

    const [aiSessions, bookings] = await Promise.all([
      this.getAISessionsInRange(startDate, endDate),
      this.getBookingsInRange(startDate, endDate),
    ]);

    const userSessionMap = this.buildUserSessionMap(aiSessions);

    // Calculate average time from first AI session to booking creation
    let totalBookingTime = 0;
    let bookingsWithTime = 0;

    for (const booking of bookings) {
      if (this.isAIAssisted(booking, userSessionMap)) {
        const sessions = userSessionMap.get(booking.userId);
        if (sessions) {
          const firstSession = sessions
            .filter((s) => booking.createdAt.getTime() - s.getTime() >= 0)
            .sort((a, b) => a.getTime() - b.getTime())[0];
          if (firstSession) {
            totalBookingTime +=
              booking.createdAt.getTime() - firstSession.getTime();
            bookingsWithTime++;
          }
        }
      }
    }

    const avgBookingTimeMinutes =
      bookingsWithTime > 0
        ? Math.round((totalBookingTime / bookingsWithTime / 1000 / 60) * 100) /
          100
        : 0;

    // Conversion rate: AI-assisted bookings vs total bookings
    const aiAssistedCount = bookings.filter((b) =>
      this.isAIAssisted(b, userSessionMap),
    ).length;

    const conversionRate =
      bookings.length > 0
        ? Math.round((aiAssistedCount / bookings.length) * 10000) / 100
        : 0;

    return {
      totalSessions: totalSessions,
      avgMessagesPerSession:
        Math.round((Number(avgMessagesPerSession[0]?.avgMessages) || 0) * 100) /
        100,
      avgBookingTimeMinutes: avgBookingTimeMinutes,
      conversionRatePercent: conversionRate,
      bookingsConverted: aiAssistedCount,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
  }
}
