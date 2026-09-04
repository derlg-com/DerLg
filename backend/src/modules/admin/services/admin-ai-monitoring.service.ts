import { Injectable, Logger } from '@nestjs/common';
import { Prisma, SupportedLanguage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class AdminAIMonitoringService {
  private readonly logger = new Logger(AdminAIMonitoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Redis key the Python agent writes the live conversation to.
   *
   * `vibe-booking/agent/session/manager.py` uses `session:{session_id}` with a
   * 7-day TTL. This service previously read `ai:session:{sessionId}` — a prefix
   * nothing ever writes — so every lookup missed the cache, fell through to a
   * database table that is also empty, and 404'd. Both services share
   * `redis://localhost:6379/0`, so the prefix was the entire bug.
   */
  private sessionCacheKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

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

  private buildUserSessionMap(
    sessions: { userId: string | null; createdAt: Date }[],
  ) {
    const map = new Map<string, Date[]>();
    for (const session of sessions) {
      // Guest sessions have no user id and cannot be correlated to a booking by
      // user, so they are excluded from the correlation map rather than keyed
      // under null. They still count toward total session volume.
      if (session.userId === null) continue;
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
    // Live state first: while the agent holds the conversation in Redis it is
    // the freshest copy, including turns not yet flushed to Postgres.
    const cached = await this.redis
      .getClient()
      .get(this.sessionCacheKey(sessionId));

    if (cached) {
      // The cached payload is opaque to us — it is written by the Python agent —
      // so it is surfaced as an unknown record rather than pretending to a shape.
      try {
        return {
          source: 'redis' as const,
          sessionId,
          expired: false,
          live: JSON.parse(cached) as Record<string, unknown>,
        };
      } catch (error) {
        // A corrupt payload should degrade to the archive, not fail the request.
        this.logger.warn(
          `Unparseable Redis payload for session ${sessionId}: ${(error as Error).message}`,
        );
      }
    }

    const session = await this.prisma.aIChatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          // seq is the agent-assigned turn ordinal and the only total order that
          // survives a batched flush — turns written in one batch can share a
          // created_at, so ordering on the timestamp is not deterministic.
          orderBy: { seq: 'asc' },
          select: {
            id: true,
            seq: true,
            role: true,
            content: true,
            messageType: true,
            metadata: true,
            helpful: true,
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

    // The Redis TTL has lapsed, but the archive still holds the transcript. The
    // previous version fetched exactly this payload and then threw it away,
    // returning `{ expired: true }` and nothing else.
    return {
      source: 'db' as const,
      sessionId,
      expired: true,
      title: session.title,
      language: session.language,
      isActive: session.isActive,
      userId: session.userId,
      guestKey: session.guestKey,
      user: session.user,
      lastMessageAt: session.lastMessageAt,
      createdAt: session.createdAt,
      messages: session.messages,
    };
  }

  /**
   * Paginated session list for the admin AI-monitoring screen.
   *
   * Correlation to bookings is done per page rather than across the whole table:
   * only the users on this page can matter, so the booking lookup stays bounded
   * no matter how large the archive grows.
   */
  async listAISessions(filters: {
    search?: string;
    language?: SupportedLanguage;
    onlyGuests?: boolean;
    page?: number;
    limit?: number;
  }) {
    const currentPage = Math.max(1, filters.page ?? 1);
    const take = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (currentPage - 1) * take;

    const where: Prisma.AIChatSessionWhereInput = {};
    if (filters.language) {
      where.language = filters.language;
    }
    if (filters.onlyGuests) {
      where.userId = null;
    }
    if (filters.search && filters.search.trim() !== '') {
      const term = filters.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { guestKey: { contains: term, mode: 'insensitive' } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { user: { fullName: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [sessions, total] = await Promise.all([
      this.prisma.aIChatSession.findMany({
        where,
        skip,
        take,
        // Most recently active first; falls back to createdAt for sessions that
        // never produced a message.
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          userId: true,
          guestKey: true,
          title: true,
          language: true,
          isActive: true,
          lastMessageAt: true,
          createdAt: true,
          user: { select: { id: true, email: true, fullName: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.aIChatSession.count({ where }),
    ]);

    const userIds = [
      ...new Set(
        sessions.map((s) => s.userId).filter((id): id is string => id !== null),
      ),
    ];

    // A session "converted" when its owner booked within 24h of it starting —
    // the same window the AI-assisted metrics use, kept consistent on purpose.
    const bookings = userIds.length
      ? await this.prisma.booking.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, createdAt: true },
        })
      : [];

    const bookingsByUser = new Map<string, Date[]>();
    for (const booking of bookings) {
      const list = bookingsByUser.get(booking.userId) ?? [];
      list.push(booking.createdAt);
      bookingsByUser.set(booking.userId, list);
    }

    const data = sessions.map((s) => {
      const userBookings = s.userId ? bookingsByUser.get(s.userId) : undefined;
      const converted = (userBookings ?? []).some((bookedAt) => {
        const diff = bookedAt.getTime() - s.createdAt.getTime();
        return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
      });

      return {
        id: s.id,
        title: s.title,
        language: s.language,
        isActive: s.isActive,
        isGuest: s.userId === null,
        userId: s.userId,
        guestKey: s.guestKey,
        user: s.user,
        messageCount: s._count.messages,
        lastMessageAt: s.lastMessageAt,
        createdAt: s.createdAt,
        convertedToBooking: converted,
      };
    });

    return {
      data,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Archived transcript for one session.
   *
   * Distinct from `getAISessionDetails`, which prefers the live Redis copy: this
   * always reads the durable rows, so the admin can inspect what was actually
   * persisted rather than what happens to still be cached.
   */
  async getAISessionTranscript(sessionId: string) {
    const session = await this.prisma.aIChatSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        guestKey: true,
        title: true,
        language: true,
        isActive: true,
        lastMessageAt: true,
        createdAt: true,
        user: { select: { id: true, email: true, fullName: true } },
        messages: {
          orderBy: { seq: 'asc' },
          select: {
            id: true,
            seq: true,
            role: true,
            content: true,
            messageType: true,
            metadata: true,
            helpful: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    return {
      ...session,
      isGuest: session.userId === null,
      messageCount: session.messages.length,
    };
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

    // Was a raw query that selected `sessionId` while grouping by `session_id`.
    // `sessionId` is the Prisma field name, not a column — the column is
    // `session_id` — so Postgres would have raised 42703 the moment the table
    // held a single row. `groupBy` removes the hand-written SQL entirely and
    // keeps the field/column mapping in Prisma's hands.
    const messageCounts = await this.prisma.aIChatMessage.groupBy({
      by: ['sessionId'],
      where: { createdAt: { gte: startDate, lte: endDate } },
      _count: { _all: true },
    });

    const avgMessagesPerSession =
      messageCounts.length > 0
        ? messageCounts.reduce((sum, row) => sum + row._count._all, 0) /
          messageCounts.length
        : 0;

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
      avgMessagesPerSession: Math.round(avgMessagesPerSession * 100) / 100,
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
