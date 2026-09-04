import { AdminAIMonitoringService } from './admin-ai-monitoring.service';

/**
 * This service had four defects that made the AI-monitoring screens useless:
 *
 *  1. it read `ai:session:{id}` from Redis, a prefix nothing writes — the agent
 *     uses `session:{id}` — so every live lookup missed,
 *  2. `getAISessionDetails` fetched a full transcript then discarded it, returning
 *     only `{ expired: true }`,
 *  3. the average-messages query was raw SQL selecting `sessionId` while grouping
 *     by `session_id`, which would raise Postgres 42703 on the first real row,
 *  4. guest sessions (nullable `userId`) were keyed into the booking-correlation
 *     map as null.
 *
 * Each is pinned below.
 */
describe('AdminAIMonitoringService', () => {
  let service: AdminAIMonitoringService;
  let prisma: {
    aIChatSession: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
    };
    aIChatMessage: { groupBy: jest.Mock };
    booking: { findMany: jest.Mock };
  };
  let redis: { getClient: jest.Mock };
  let redisClient: { get: jest.Mock };

  const ARCHIVED_SESSION = {
    id: 'sess-1',
    userId: 'user-1',
    guestKey: null,
    title: null,
    language: 'en',
    isActive: true,
    lastMessageAt: new Date('2026-08-20'),
    createdAt: new Date('2026-08-20'),
    user: { id: 'user-1', email: 'a@b.c', fullName: 'Dara' },
    messages: [
      {
        id: 'm-0',
        seq: 0,
        role: 'user',
        content: 'temples?',
        messageType: 'text',
        metadata: null,
        helpful: null,
        createdAt: new Date(),
      },
      {
        id: 'm-1',
        seq: 1,
        role: 'assistant',
        content: 'Angkor Wat',
        messageType: 'trip_card',
        metadata: null,
        helpful: true,
        createdAt: new Date(),
      },
    ],
  };

  beforeEach(() => {
    redisClient = { get: jest.fn().mockResolvedValue(null) };
    redis = { getClient: jest.fn(() => redisClient) };
    prisma = {
      aIChatSession: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      aIChatMessage: { groupBy: jest.fn().mockResolvedValue([]) },
      booking: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new AdminAIMonitoringService(prisma as never, redis as never);
  });

  describe('getAISessionDetails', () => {
    it('should read the prefix the agent actually writes', async () => {
      redisClient.get.mockResolvedValue('{"session_id":"sess-1"}');

      await service.getAISessionDetails('sess-1');

      // `ai:session:` was the original prefix and matched nothing.
      expect(redisClient.get).toHaveBeenCalledWith('session:sess-1');
    });

    it('should return the live state when Redis has it', async () => {
      redisClient.get.mockResolvedValue(
        '{"session_id":"sess-1","messages":[]}',
      );

      const result = await service.getAISessionDetails('sess-1');

      expect(result).toMatchObject({ source: 'redis', expired: false });
    });

    it('should fall back to the archive and RETURN the transcript', async () => {
      prisma.aIChatSession.findUnique.mockResolvedValue(ARCHIVED_SESSION);

      const result = await service.getAISessionDetails('sess-1');

      // The original threw this payload away and returned only { expired: true }.
      expect(result).toMatchObject({ source: 'db', expired: true });
      expect(result?.messages).toHaveLength(2);
    });

    it('should order archived messages by seq, not createdAt', async () => {
      prisma.aIChatSession.findUnique.mockResolvedValue(ARCHIVED_SESSION);

      await service.getAISessionDetails('sess-1');

      // Turns written in one batched flush can share a timestamp, so createdAt is
      // not a total order.
      expect(
        prisma.aIChatSession.findUnique.mock.calls[0][0].include.messages
          .orderBy,
      ).toEqual({ seq: 'asc' });
    });

    it('should degrade to the archive when the cached payload is corrupt', async () => {
      redisClient.get.mockResolvedValue('{not json');
      prisma.aIChatSession.findUnique.mockResolvedValue(ARCHIVED_SESSION);

      const result = await service.getAISessionDetails('sess-1');

      expect(result).toMatchObject({ source: 'db' });
    });

    it('should return null when neither Redis nor the archive has the session', async () => {
      await expect(service.getAISessionDetails('missing')).resolves.toBeNull();
    });
  });

  describe('getAIPerformanceMetrics', () => {
    it('should average message counts via groupBy instead of raw SQL', async () => {
      prisma.aIChatSession.count.mockResolvedValue(2);
      prisma.aIChatMessage.groupBy.mockResolvedValue([
        { sessionId: 's1', _count: { _all: 4 } },
        { sessionId: 's2', _count: { _all: 2 } },
      ]);

      const result = await service.getAIPerformanceMetrics();

      expect(prisma.aIChatMessage.groupBy).toHaveBeenCalled();
      expect(result.avgMessagesPerSession).toBe(3);
    });

    it('should report zero rather than NaN when there are no messages', async () => {
      const result = await service.getAIPerformanceMetrics();

      expect(result.avgMessagesPerSession).toBe(0);
    });
  });

  describe('guest sessions', () => {
    it('should exclude guests from booking correlation instead of keying on null', async () => {
      prisma.aIChatSession.findMany.mockResolvedValue([
        { id: 's1', userId: null, createdAt: new Date('2026-08-20') },
      ]);
      prisma.booking.findMany.mockResolvedValue([
        {
          id: 'b1',
          userId: 'someone',
          createdAt: new Date('2026-08-20'),
          totalUsd: 100,
          status: 'confirmed',
          reference: 'R1',
        },
      ]);

      const result = await service.getAIAssistedBookings();

      // A guest has no user id, so no booking can be attributed to them.
      expect(result.aiAssistedBookings).toBe(0);
      expect(result.totalBookings).toBe(1);
    });
  });

  describe('listAISessions', () => {
    it('should filter to guests only when asked', async () => {
      await service.listAISessions({ onlyGuests: true });

      expect(
        prisma.aIChatSession.findMany.mock.calls[0][0].where.userId,
      ).toBeNull();
    });

    it('should cap limit at 100', async () => {
      await service.listAISessions({ limit: 500 });

      expect(prisma.aIChatSession.findMany.mock.calls[0][0].take).toBe(100);
    });

    it('should filter by language when one is supplied', async () => {
      await service.listAISessions({ language: 'ZH' as never });

      expect(
        prisma.aIChatSession.findMany.mock.calls[0][0].where.language,
      ).toBe('ZH');
    });

    it('should search title, guest handle and the owner profile', async () => {
      await service.listAISessions({ search: 'angkor' });

      const or = prisma.aIChatSession.findMany.mock.calls[0][0].where.OR;
      // Guest sessions have no user relation, so title/guestKey must be searched
      // too or anonymous conversations become unfindable.
      expect(or).toEqual([
        { title: { contains: 'angkor', mode: 'insensitive' } },
        { guestKey: { contains: 'angkor', mode: 'insensitive' } },
        { user: { email: { contains: 'angkor', mode: 'insensitive' } } },
        { user: { fullName: { contains: 'angkor', mode: 'insensitive' } } },
      ]);
    });

    it('should trim the search term', async () => {
      await service.listAISessions({ search: '  angkor  ' });

      const or = prisma.aIChatSession.findMany.mock.calls[0][0].where.OR;
      expect(or[0].title.contains).toBe('angkor');
    });

    it('should ignore a whitespace-only search rather than matching nothing', async () => {
      await service.listAISessions({ search: '   ' });

      expect(
        prisma.aIChatSession.findMany.mock.calls[0][0].where.OR,
      ).toBeUndefined();
    });

    it('should clamp a page below 1 instead of computing a negative skip', async () => {
      await service.listAISessions({ page: 0 });

      // A negative skip is a Prisma error, not an empty page.
      expect(prisma.aIChatSession.findMany.mock.calls[0][0].skip).toBe(0);
    });

    it('should mark a session converted when its owner booked within 24h', async () => {
      const started = new Date('2026-08-20T10:00:00Z');
      prisma.aIChatSession.findMany.mockResolvedValue([
        {
          id: 's1',
          userId: 'user-1',
          guestKey: null,
          title: null,
          language: 'en',
          isActive: true,
          lastMessageAt: started,
          createdAt: started,
          user: { id: 'user-1', email: 'a@b.c', fullName: 'Dara' },
          _count: { messages: 4 },
        },
      ]);
      prisma.booking.findMany.mockResolvedValue([
        { userId: 'user-1', createdAt: new Date('2026-08-20T12:00:00Z') },
      ]);

      const result = await service.listAISessions({});

      expect(result.data[0].convertedToBooking).toBe(true);
      expect(result.data[0].isGuest).toBe(false);
    });

    it('should not mark a booking made before the session as a conversion', async () => {
      const started = new Date('2026-08-20T10:00:00Z');
      prisma.aIChatSession.findMany.mockResolvedValue([
        {
          id: 's1',
          userId: 'user-1',
          guestKey: null,
          title: null,
          language: 'en',
          isActive: true,
          lastMessageAt: started,
          createdAt: started,
          user: null,
          _count: { messages: 1 },
        },
      ]);
      prisma.booking.findMany.mockResolvedValue([
        { userId: 'user-1', createdAt: new Date('2026-08-19T10:00:00Z') },
      ]);

      const result = await service.listAISessions({});

      expect(result.data[0].convertedToBooking).toBe(false);
    });

    it('should skip the booking query entirely for a page of only guests', async () => {
      prisma.aIChatSession.findMany.mockResolvedValue([
        {
          id: 's1',
          userId: null,
          guestKey: 'guest-a',
          title: null,
          language: 'en',
          isActive: true,
          lastMessageAt: null,
          createdAt: new Date(),
          user: null,
          _count: { messages: 2 },
        },
      ]);

      const result = await service.listAISessions({});

      expect(prisma.booking.findMany).not.toHaveBeenCalled();
      expect(result.data[0].isGuest).toBe(true);
    });
  });

  describe('getAISessionTranscript', () => {
    it('should read the archive rather than the live cache', async () => {
      prisma.aIChatSession.findUnique.mockResolvedValue(ARCHIVED_SESSION);

      const result = await service.getAISessionTranscript('sess-1');

      // Deliberately not Redis: an admin needs to see what was persisted.
      expect(redis.getClient).not.toHaveBeenCalled();
      expect(result?.messageCount).toBe(2);
    });

    it('should return null for an unknown session so the controller can 404', async () => {
      await expect(
        service.getAISessionTranscript('missing'),
      ).resolves.toBeNull();
    });
  });

  describe('getAIAssistedBookings', () => {
    const SESSION_AT = new Date('2026-08-20T10:00:00Z');

    /** A booking N hours after the AI session, by the same user. */
    function bookingAfter(hours: number, overrides = {}) {
      return {
        id: 'bk-1',
        reference: 'DL-001',
        userId: 'user-1',
        status: 'confirmed',
        totalUsd: '120.50',
        createdAt: new Date(SESSION_AT.getTime() + hours * 3600_000),
        ...overrides,
      };
    }

    beforeEach(() => {
      prisma.aIChatSession.findMany.mockResolvedValue([
        { userId: 'user-1', createdAt: SESSION_AT },
      ]);
    });

    it('should attribute a booking made within 24h of the session', async () => {
      prisma.booking.findMany.mockResolvedValue([bookingAfter(2)]);

      const result = await service.getAIAssistedBookings();

      expect(result.totalBookings).toBe(1);
      expect(result.aiAssistedBookings).toBe(1);
      expect(result.aiAssistedRevenueUsd).toBeCloseTo(120.5);
    });

    it('should not attribute a booking made more than 24h later', async () => {
      prisma.booking.findMany.mockResolvedValue([bookingAfter(25)]);

      const result = await service.getAIAssistedBookings();

      expect(result.totalBookings).toBe(1);
      expect(result.aiAssistedBookings).toBe(0);
      expect(result.aiAssistedRevenueUsd).toBe(0);
    });

    it('should not attribute a booking made BEFORE the session', async () => {
      prisma.booking.findMany.mockResolvedValue([bookingAfter(-1)]);

      // The chat cannot have caused a booking that already existed.
      const result = await service.getAIAssistedBookings();

      expect(result.aiAssistedBookings).toBe(0);
    });

    it('should not attribute a booking by a different user', async () => {
      prisma.booking.findMany.mockResolvedValue([
        bookingAfter(2, { userId: 'user-2' }),
      ]);

      const result = await service.getAIAssistedBookings();

      expect(result.aiAssistedBookings).toBe(0);
    });

    it('should convert Decimal totals to numbers in the returned rows', async () => {
      prisma.booking.findMany.mockResolvedValue([bookingAfter(2)]);

      const result = await service.getAIAssistedBookings();

      expect(typeof result.bookings[0].totalUsd).toBe('number');
      expect(result.bookings[0].totalUsd).toBe(120.5);
    });

    it('should echo the resolved period so the caller knows what was measured', async () => {
      const result = await service.getAIAssistedBookings({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(result.period.startDate).toContain('2026-08-01');
      expect(result.period.endDate).toContain('2026-08-31');
    });

    it('should default to a range when none is supplied', async () => {
      const result = await service.getAIAssistedBookings();

      expect(result.period.startDate).toBeTruthy();
      expect(result.period.endDate).toBeTruthy();
    });
  });

  describe('getAIBookingSuccessRate', () => {
    const SESSION_AT = new Date('2026-08-20T10:00:00Z');

    function booking(status: string, id: string) {
      return {
        id,
        reference: id,
        userId: 'user-1',
        status,
        totalUsd: '10',
        createdAt: new Date(SESSION_AT.getTime() + 3600_000),
      };
    }

    beforeEach(() => {
      prisma.aIChatSession.findMany.mockResolvedValue([
        { userId: 'user-1', createdAt: SESSION_AT },
      ]);
    });

    it('should count confirmed and completed as successful', async () => {
      prisma.booking.findMany.mockResolvedValue([
        booking('confirmed', 'a'),
        booking('completed', 'b'),
        booking('cancelled', 'c'),
        booking('hold', 'd'),
      ]);

      const result = await service.getAIBookingSuccessRate();

      expect(result.totalAiAssistedBookings).toBe(4);
      expect(result.successfulBookings).toBe(2);
      expect(result.successRatePercent).toBe(50);
    });

    it('should report zero rather than dividing by zero when nothing was AI-assisted', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      const result = await service.getAIBookingSuccessRate();

      expect(result.successRatePercent).toBe(0);
      expect(result.totalAiAssistedBookings).toBe(0);
    });

    it('should break out both halves of the former reserved status', async () => {
      prisma.booking.findMany.mockResolvedValue([
        booking('hold', 'a'),
        booking('pending_payment', 'b'),
      ]);

      // merge_booking_methods split `reserved` into `hold` and
      // `pending_payment`; reporting only one would lose half the funnel.
      const result = await service.getAIBookingSuccessRate();

      expect(result.byStatus.hold).toBe(1);
      expect(result.byStatus.pendingPayment).toBe(1);
    });

    it('should have a byStatus breakdown that sums to the total', async () => {
      prisma.booking.findMany.mockResolvedValue([
        booking('hold', 'a'),
        booking('pending_payment', 'b'),
        booking('confirmed', 'c'),
        booking('completed', 'd'),
        booking('cancelled', 'e'),
        booking('payment_failed', 'f'),
        booking('expired', 'g'),
        booking('no_show', 'h'),
      ]);

      const result = await service.getAIBookingSuccessRate();

      const summed = Object.values(result.byStatus).reduce((a, b) => a + b, 0);
      expect(summed).toBe(result.totalAiAssistedBookings);
    });

    it('should round the rate to two decimal places', async () => {
      prisma.booking.findMany.mockResolvedValue([
        booking('confirmed', 'a'),
        booking('cancelled', 'b'),
        booking('cancelled', 'c'),
      ]);

      const result = await service.getAIBookingSuccessRate();

      expect(result.successRatePercent).toBe(33.33);
    });
  });

  describe('getAIPerformanceMetrics (timing and conversion)', () => {
    const FIRST = new Date('2026-08-20T10:00:00Z');
    const SECOND = new Date('2026-08-20T11:00:00Z');

    it('should measure booking time from the FIRST qualifying session', async () => {
      prisma.aIChatSession.findMany.mockResolvedValue([
        { userId: 'user-1', createdAt: SECOND },
        { userId: 'user-1', createdAt: FIRST },
      ]);
      prisma.booking.findMany.mockResolvedValue([
        {
          id: 'bk-1',
          reference: 'DL-001',
          userId: 'user-1',
          status: 'confirmed',
          totalUsd: '10',
          createdAt: new Date('2026-08-20T12:00:00Z'),
        },
      ]);

      const result = await service.getAIPerformanceMetrics();

      // Two hours from FIRST, not one from SECOND — the array order above is
      // deliberately not chronological.
      expect(result.avgBookingTimeMinutes).toBe(120);
    });

    it('should report the AI-assisted share of all bookings as the conversion rate', async () => {
      prisma.aIChatSession.findMany.mockResolvedValue([
        { userId: 'user-1', createdAt: FIRST },
      ]);
      prisma.booking.findMany.mockResolvedValue([
        {
          id: 'bk-1',
          reference: 'a',
          userId: 'user-1',
          status: 'confirmed',
          totalUsd: '10',
          createdAt: SECOND,
        },
        {
          id: 'bk-2',
          reference: 'b',
          userId: 'user-9',
          status: 'confirmed',
          totalUsd: '10',
          createdAt: SECOND,
        },
      ]);

      const result = await service.getAIPerformanceMetrics();

      expect(result.conversionRatePercent).toBe(50);
      expect(result.bookingsConverted).toBe(1);
    });

    it('should report zero timing and conversion when there are no bookings', async () => {
      const result = await service.getAIPerformanceMetrics();

      expect(result.avgBookingTimeMinutes).toBe(0);
      expect(result.conversionRatePercent).toBe(0);
      expect(result.bookingsConverted).toBe(0);
    });

    it('should scope the message groupBy to the requested window', async () => {
      await service.getAIPerformanceMetrics({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      const where = prisma.aIChatMessage.groupBy.mock.calls[0][0].where;
      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(where.createdAt.lte).toBeInstanceOf(Date);
    });
  });
});
