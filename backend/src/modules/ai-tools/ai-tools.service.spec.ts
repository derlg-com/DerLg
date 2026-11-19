import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/services/payments.service';
import { AiToolsService } from './ai-tools.service';

/** Minimal PaymentsService double: only `startPayment` is reachable from here. */
function paymentsStub() {
  return { startPayment: jest.fn() };
}

describe('AiToolsService.searchTrips (budget/duration relaxation)', () => {
  let service: AiToolsService;
  let prisma: { trip: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { trip: { findMany: jest.fn().mockResolvedValue([]) } };
    const mod = await Test.createTestingModule({
      providers: [
        AiToolsService,
        { provide: PrismaService, useValue: prisma },
        // The QR tool delegates to PaymentsService; these specs cover the
        // catalogue and archive tools, so a stub keeps the module resolvable
        // without dragging Stripe and Redis into scope.
        { provide: PaymentsService, useValue: paymentsStub() },
      ],
    }).compile();
    service = mod.get(AiToolsService);
  });

  it('omits budget and duration filters when not provided', async () => {
    await service.searchTrips({ destination: 'Siem Reap' });
    const where = prisma.trip.findMany.mock.calls[0][0].where;
    expect(where.basePriceUsd).toBeUndefined();
    expect(where.durationDays).toBeUndefined();
    expect(where.isPublished).toBe(true);
  });

  it('applies budget as an upper bound when provided', async () => {
    await service.searchTrips({ destination: 'Siem Reap', budget_usd: 600 });
    const where = prisma.trip.findMany.mock.calls[0][0].where;
    expect(where.basePriceUsd).toEqual({ lte: 600 });
  });

  it('uses a +/-2 day tolerance window for duration', async () => {
    await service.searchTrips({ destination: 'Siem Reap', duration_days: 3 });
    const where = prisma.trip.findMany.mock.calls[0][0].where;
    expect(where.durationDays).toEqual({ gte: 1, lte: 5 });
  });
});

describe('AiToolsService.searchGuides (card-ready shape)', () => {
  let service: AiToolsService;
  let prisma: {
    guide: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      guide: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
    };
    const mod = await Test.createTestingModule({
      providers: [
        AiToolsService,
        { provide: PrismaService, useValue: prisma },
        // The QR tool delegates to PaymentsService; these specs cover the
        // catalogue and archive tools, so a stub keeps the module resolvable
        // without dragging Stripe and Redis into scope.
        { provide: PaymentsService, useValue: paymentsStub() },
      ],
    }).compile();
    service = mod.get(AiToolsService);
  });

  it('returns name (from user.fullName), languages, and verification', async () => {
    prisma.guide.findMany.mockResolvedValue([
      {
        id: 'g1',
        userId: 'u1',
        bio: 'Temple expert',
        avatarUrl: 'a.jpg',
        pricePerDayUsd: 50,
        province: 'Siem Reap',
        isVerified: true,
        languages: [{ language: 'en' }, { language: 'zh' }],
        specialties: [{ specialty: 'culture_history' }],
        trips: [],
      },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', fullName: 'Sok Dara' },
    ]);

    const result = await service.searchGuides({
      location: 'Siem Reap',
      language: 'en',
      date: '2026-07-01',
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Sok Dara');
    expect(result[0].languages).toEqual(['en', 'zh']);
    expect(result[0].specialties).toEqual(['culture_history']);
    expect(result[0].is_verified).toBe(true);
    expect(result[0].price_per_day_usd).toBe(50);
  });

  it('falls back to "Local Guide" when the user has no fullName', async () => {
    prisma.guide.findMany.mockResolvedValue([
      {
        id: 'g2',
        userId: 'u2',
        bio: null,
        avatarUrl: null,
        pricePerDayUsd: 40,
        province: 'Kampot',
        isVerified: true,
        languages: [{ language: 'en' }],
        specialties: [],
        trips: [],
      },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: 'u2', fullName: null }]);

    const result = await service.searchGuides({
      location: 'Kampot',
      language: 'en',
      date: '2026-07-01',
    });
    expect(result[0].name).toBe('Local Guide');
  });
});

describe('AiToolsService.createCustomTrip (P6b server-side pricing)', () => {
  let service: AiToolsService;
  let prisma: {
    hotelRoom: { findUnique: jest.Mock };
    guide: { findUnique: jest.Mock };
    transportationVehicle: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    trip: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      hotelRoom: { findUnique: jest.fn() },
      guide: { findUnique: jest.fn() },
      transportationVehicle: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      trip: { create: jest.fn() },
    };
    const mod = await Test.createTestingModule({
      providers: [
        AiToolsService,
        { provide: PrismaService, useValue: prisma },
        // The QR tool delegates to PaymentsService; these specs cover the
        // catalogue and archive tools, so a stub keeps the module resolvable
        // without dragging Stripe and Redis into scope.
        { provide: PaymentsService, useValue: paymentsStub() },
      ],
    }).compile();
    service = mod.get(AiToolsService);
  });

  it('rejects a trip with no components and no extras', async () => {
    await expect(
      service.createCustomTrip({ title: 'Empty', duration_days: 3 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.trip.create).not.toHaveBeenCalled();
  });

  it('sums components x duration plus extras, caps nothing below 500/unit', async () => {
    prisma.hotelRoom.findUnique.mockResolvedValue({
      id: 'r1',
      roomType: 'Deluxe King',
      priceUsd: 120,
      hotel: { translations: [{ name: 'Sokha Siem Reap' }] },
    });
    prisma.guide.findUnique.mockResolvedValue({
      id: 'g1',
      userId: 'u1',
      pricePerDayUsd: 45,
    });
    prisma.transportationVehicle.findUnique.mockResolvedValue({
      id: 'v1',
      name: 'Phnom Penh VIP Hiace',
      priceUsd: 90,
    });
    prisma.user.findUnique.mockResolvedValue({ fullName: 'Sok Dara' });
    prisma.trip.create.mockResolvedValue({ id: 'trip-1' });

    const result = await service.createCustomTrip({
      title: '3-day Siem Reap custom',
      duration_days: 3,
      hotel_room_id: 'r1',
      guide_id: 'g1',
      vehicle_id: 'v1',
      extras: [
        { name: 'Sunrise photo session', unit_price_usd: 40, quantity: 1 },
      ],
    });

    expect(result.total_usd).toBe(120 * 3 + 45 * 3 + 90 * 3 + 40);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toMatchObject({
      type: 'hotel',
      name: 'Sokha Siem Reap',
      quantity: 3,
      unit_price_usd: 120,
    });
    expect(result.extras[0].subtotal_usd).toBe(40);

    const createArg = prisma.trip.create.mock.calls[0][0];
    expect(createArg.data.category).toBe('custom');
    expect(createArg.data.basePriceUsd).toBe(result.total_usd);
    expect(createArg.data.isPublished).toBe(true);
    expect(createArg.data.guides).toEqual({ connect: { id: 'g1' } });
    expect(createArg.data.extras).toEqual(result.extras);
  });

  it('throws 404 when a referenced component does not exist', async () => {
    prisma.hotelRoom.findUnique.mockResolvedValue(null);
    prisma.guide.findUnique.mockResolvedValue(null);
    prisma.transportationVehicle.findUnique.mockResolvedValue(null);

    await expect(
      service.createCustomTrip({
        title: 'Broken',
        duration_days: 2,
        hotel_room_id: 'missing-room',
        extras: [{ name: 'x', unit_price_usd: 10, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AiToolsService.sendSosAlert (user existence gate)', () => {
  let service: AiToolsService;
  let prisma: {
    user: { findUnique: jest.Mock };
    emergencyAlert: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      emergencyAlert: { create: jest.fn() },
    };
    const mod = await Test.createTestingModule({
      providers: [
        AiToolsService,
        { provide: PrismaService, useValue: prisma },
        // The QR tool delegates to PaymentsService; these specs cover the
        // catalogue and archive tools, so a stub keeps the module resolvable
        // without dragging Stripe and Redis into scope.
        { provide: PaymentsService, useValue: paymentsStub() },
      ],
    }).compile();
    service = mod.get(AiToolsService);
  });

  it('throws BadRequestException (400) for a non-existent user and does not write an alert', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.sendSosAlert({
        user_id: 'guest-not-a-real-row',
        location: '11.5564,104.9282',
        message: 'I had an accident',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // The FK-violating write must never be attempted for a missing user.
    expect(prisma.emergencyAlert.create).not.toHaveBeenCalled();
  });

  it('writes the emergency alert for a valid user and reports sent', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'real-user-uuid' });
    prisma.emergencyAlert.create.mockResolvedValue({ id: 'alert-1' });

    const result = await service.sendSosAlert({
      user_id: 'real-user-uuid',
      location: '11.5564,104.9282',
      message: 'Emergency near the river',
    });

    expect(result.sent).toBe(true);
    expect(prisma.emergencyAlert.create).toHaveBeenCalledTimes(1);
    const createArg = prisma.emergencyAlert.create.mock.calls[0][0];
    expect(createArg.data.userId).toBe('real-user-uuid');
    expect(createArg.data.alertType).toBe('sos');
    expect(createArg.data.latitude).toBeCloseTo(11.5564);
    expect(createArg.data.longitude).toBeCloseTo(104.9282);
  });
});

/**
 * Chat archive — the only sanctioned write path into ai_chat_sessions /
 * ai_chat_messages, since the AI service has no database credentials.
 *
 * Before this existed, conversations lived only in Redis with a 7-day TTL and a
 * 60-turn cap, so no transcript survived and every admin AI metric read zero.
 *
 * The load-bearing property is idempotency. The agent flushes fire-and-forget and
 * only advances its `flushed_seq` on success, so a timeout re-sends turns that may
 * already have landed. `skipDuplicates` plus the [sessionId, seq] unique index is
 * what stops those becoming duplicates.
 */
describe('AiToolsService — chat archive', () => {
  let service: AiToolsService;
  let prisma: {
    aIChatSession: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    aIChatMessage: {
      createMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      aIChatSession: {
        upsert: jest.fn().mockResolvedValue({
          id: 'sess-1',
          userId: null,
          guestKey: 'guest-a',
          language: 'en',
        }),
        findUnique: jest.fn().mockResolvedValue({ id: 'sess-1' }),
        update: jest.fn().mockResolvedValue({ id: 'sess-1', userId: 'user-1' }),
      },
      aIChatMessage: {
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'msg-1' }),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'msg-1', seq: 1, helpful: false }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) },
      // The append path passes an array of operations.
      $transaction: jest
        .fn()
        .mockResolvedValue([{ count: 3 }, { id: 'sess-1' }]),
    };
    const mod = await Test.createTestingModule({
      providers: [
        AiToolsService,
        { provide: PrismaService, useValue: prisma },
        // The QR tool delegates to PaymentsService; these specs cover the
        // catalogue and archive tools, so a stub keeps the module resolvable
        // without dragging Stripe and Redis into scope.
        { provide: PaymentsService, useValue: paymentsStub() },
      ],
    }).compile();
    service = mod.get(AiToolsService);
  });

  describe('upsertChatSession', () => {
    it('should be idempotent on session_id so a reconnect does not fork the transcript', async () => {
      await service.upsertChatSession({ session_id: 'sess-1' });

      expect(prisma.aIChatSession.upsert).toHaveBeenCalled();
      expect(prisma.aIChatSession.upsert.mock.calls[0][0].where).toEqual({
        id: 'sess-1',
      });
    });

    it('should accept a guest session with no user id', async () => {
      const result = await service.upsertChatSession({
        session_id: 'sess-1',
        guest_key: 'guest-a',
      });

      // Guests are most of the pre-login funnel; a NOT NULL user_id made their
      // conversations impossible to archive at all.
      expect(result.user_id).toBeNull();
      expect(result.guest_key).toBe('guest-a');
    });

    it('should never overwrite a known user id with null on reconnect', async () => {
      await service.upsertChatSession({ session_id: 'sess-1' });

      // `?? undefined` leaves the column untouched; `?? null` would blank it.
      expect(
        prisma.aIChatSession.upsert.mock.calls[0][0].update.userId,
      ).toBeUndefined();
    });

    it('should default the language to en', async () => {
      await service.upsertChatSession({ session_id: 'sess-1' });

      expect(prisma.aIChatSession.upsert.mock.calls[0][0].create.language).toBe(
        'en',
      );
    });
  });

  describe('appendChatMessages', () => {
    const batch = {
      messages: [
        { seq: 0, role: 'user', content: 'hi' },
        { seq: 1, role: 'assistant', content: 'hello' },
        { seq: 2, role: 'user', content: 'temples?' },
      ],
    };

    it('should skip duplicates so a retried flush cannot double-write', async () => {
      await service.appendChatMessages('sess-1', batch);

      const createManyCall = prisma.aIChatMessage.createMany.mock.calls[0][0];
      expect(createManyCall.skipDuplicates).toBe(true);
    });

    it('should report inserted separately from received', async () => {
      // A fully duplicate batch: the backend accepted it but wrote nothing.
      prisma.$transaction.mockResolvedValue([{ count: 0 }, { id: 'sess-1' }]);

      const result = await service.appendChatMessages('sess-1', batch);

      expect(result).toEqual({ inserted: 0, received: 3, last_seq: 2 });
    });

    it('should advance last_message_at in the same transaction as the insert', async () => {
      await service.appendChatMessages('sess-1', batch);

      // One transaction, so last_message_at can never move for a batch that
      // failed to insert — the admin session list orders on that column.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.aIChatSession.update).toHaveBeenCalled();
    });

    it('should report the highest seq regardless of payload order', async () => {
      const result = await service.appendChatMessages('sess-1', {
        messages: [
          { seq: 5, role: 'user', content: 'later' },
          { seq: 2, role: 'user', content: 'earlier' },
        ],
      });

      expect(result.last_seq).toBe(5);
    });

    it('should short-circuit an empty batch without touching the database', async () => {
      const result = await service.appendChatMessages('sess-1', {
        messages: [],
      });

      expect(result).toEqual({ inserted: 0, received: 0 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should default message_type to text', async () => {
      await service.appendChatMessages('sess-1', batch);

      const rows = prisma.aIChatMessage.createMany.mock.calls[0][0].data;
      expect(rows[0].messageType).toBe('text');
    });

    it('should 404 for an unknown session', async () => {
      prisma.aIChatSession.findUnique.mockResolvedValue(null);

      await expect(
        service.appendChatMessages('missing', batch as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rebindChatSession', () => {
    it('should attach an archived guest session to a real user', async () => {
      const result = await service.rebindChatSession('sess-1', {
        user_id: 'user-1',
      });

      // Without this, turns archived before sign-in stay anonymous and never
      // correlate to the booking they produced.
      expect(result.user_id).toBe('user-1');
    });

    it('should 404 for an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.rebindChatSession('sess-1', { user_id: 'ghost' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should 404 for an unknown session', async () => {
      prisma.aIChatSession.findUnique.mockResolvedValue(null);

      await expect(
        service.rebindChatSession('missing', { user_id: 'user-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should 403 when attempting to rebind a session already bound to a different user', async () => {
      prisma.aIChatSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        userId: 'original-owner',
      });

      await expect(
        service.rebindChatSession('sess-1', { user_id: 'attacker-user' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('setChatMessageFeedback', () => {
    it('should address the turn by (session, seq), not its database id', async () => {
      await service.setChatMessageFeedback('sess-1', 1, {
        helpful: false,
      });

      // The agent knows the ordinal it assigned; it never sees the row id.
      expect(prisma.aIChatMessage.findUnique.mock.calls[0][0].where).toEqual({
        sessionId_seq: { sessionId: 'sess-1', seq: 1 },
      });
    });

    it('should persist the vote', async () => {
      const result = await service.setChatMessageFeedback('sess-1', 1, {
        helpful: false,
      });

      expect(result.helpful).toBe(false);
    });

    it('should 404 for a seq that does not exist in the session', async () => {
      prisma.aIChatMessage.findUnique.mockResolvedValue(null);

      await expect(
        service.setChatMessageFeedback('sess-1', 99, {
          helpful: true,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

describe('AiToolsService.checkAvailability and createBookingHold', () => {
  let service: AiToolsService;
  let prisma: {
    trip: { findUnique: jest.Mock };
    hotelRoom: { findUnique: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
    guide: { findUnique: jest.Mock };
    transportationVehicle: { findUnique: jest.Mock };
    bookingItem: { count: jest.Mock; findMany: jest.Mock };
    user: { findUnique: jest.Mock };
    booking: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const FUTURE_DATE = new Date(Date.now() + 86400000 * 10)
    .toISOString()
    .slice(0, 10);
  const PAST_DATE = '2020-01-01';

  beforeEach(async () => {
    prisma = {
      trip: { findUnique: jest.fn() },
      hotelRoom: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      guide: { findUnique: jest.fn() },
      transportationVehicle: { findUnique: jest.fn() },
      bookingItem: { count: jest.fn(), findMany: jest.fn() },
      user: { findUnique: jest.fn() },
      booking: { create: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const mod = await Test.createTestingModule({
      providers: [
        AiToolsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentsService, useValue: paymentsStub() },
      ],
    }).compile();
    service = mod.get(AiToolsService);
  });

  describe('checkAvailability', () => {
    it('throws BadRequestException for invalid date format', async () => {
      await expect(
        service.checkAvailability({
          item_type: 'trip',
          item_id: 't1',
          date: 'not-a-date',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('checks trip availability by summing booked quantities', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 't1',
        isPublished: true,
        maxCapacity: 10,
      });
      prisma.bookingItem.findMany.mockResolvedValue([
        { quantity: 4 },
        { quantity: 3 },
      ]);

      const result = await service.checkAvailability({
        item_type: 'trip',
        item_id: 't1',
        date: FUTURE_DATE,
      });

      expect(result.available).toBe(true);
      expect(result.remaining).toBe(3);
    });

    it('throws NotFoundException if trip is unpublished or not found', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 't1',
        isPublished: false,
      });

      await expect(
        service.checkAvailability({
          item_type: 'trip',
          item_id: 't1',
          date: FUTURE_DATE,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createBookingHold', () => {
    it('rejects past travel date with BadRequestException', async () => {
      await expect(
        service.createBookingHold({
          user_id: 'user-1',
          item_type: 'trip',
          item_id: 't1',
          travel_date: PAST_DATE,
          people_count: 2,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects invalid people count with BadRequestException', async () => {
      await expect(
        service.createBookingHold({
          user_id: 'user-1',
          item_type: 'trip',
          item_id: 't1',
          travel_date: FUTURE_DATE,
          people_count: 0,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.createBookingHold({
          user_id: 'user-1',
          item_type: 'trip',
          item_id: 't1',
          travel_date: FUTURE_DATE,
          people_count: -3,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.createBookingHold({
          user_id: 'user-1',
          item_type: 'trip',
          item_id: 't1',
          travel_date: FUTURE_DATE,
          people_count: 55,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createBookingHold({
          user_id: 'missing-user',
          item_type: 'trip',
          item_id: 't1',
          travel_date: FUTURE_DATE,
          people_count: 2,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('successfully creates a hold for trip with multi-day duration', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.trip.findUnique.mockResolvedValue({
        id: 't1',
        isPublished: true,
        maxCapacity: 10,
        basePriceUsd: 150,
        durationDays: 3,
      });
      prisma.bookingItem.findMany.mockResolvedValue([{ quantity: 2 }]);
      prisma.booking.create.mockResolvedValue({
        id: 'b1',
        reference: 'DLG-2026-12345',
        totalUsd: 300,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      const result = await service.createBookingHold({
        user_id: 'user-1',
        item_type: 'trip',
        item_id: 't1',
        travel_date: FUTURE_DATE,
        people_count: 2,
      });

      expect(result.booking_id).toBe('b1');
      expect(result.amount_usd).toBe(300);
      expect(result.methods).toEqual(['card', 'aba_qr']);

      const createCall = prisma.booking.create.mock.calls[0][0];
      expect(createCall.data.totalUsd).toBe(300);
      expect(createCall.data.passengerCount).toBe(2);
      expect(createCall.data.items.create.quantity).toBe(2);
      // endDate should span duration
      const startDate = new Date(createCall.data.items.create.startDate);
      const endDate = new Date(createCall.data.items.create.endDate);
      expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
    });

    it('rejects when trip is fully booked with BadRequestException (not 500)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.trip.findUnique.mockResolvedValue({
        id: 't1',
        isPublished: true,
        maxCapacity: 10,
        basePriceUsd: 150,
        durationDays: 1,
      });
      prisma.bookingItem.findMany.mockResolvedValue([{ quantity: 9 }]);

      await expect(
        service.createBookingHold({
          user_id: 'user-1',
          item_type: 'trip',
          item_id: 't1',
          travel_date: FUTURE_DATE,
          people_count: 2,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when total booking exceeds $5,000 USD cap', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.trip.findUnique.mockResolvedValue({
        id: 't1',
        isPublished: true,
        maxCapacity: 50,
        basePriceUsd: 3000,
        durationDays: 1,
      });
      prisma.bookingItem.findMany.mockResolvedValue([]);

      await expect(
        service.createBookingHold({
          user_id: 'user-1',
          item_type: 'trip',
          item_id: 't1',
          travel_date: FUTURE_DATE,
          people_count: 2, // 2 * 3000 = 6000 > 5000
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when total booking is $0 or negative', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.trip.findUnique.mockResolvedValue({
        id: 't1',
        isPublished: true,
        maxCapacity: 50,
        basePriceUsd: 0,
        durationDays: 1,
      });
      prisma.bookingItem.findMany.mockResolvedValue([]);

      await expect(
        service.createBookingHold({
          user_id: 'user-1',
          item_type: 'trip',
          item_id: 't1',
          travel_date: FUTURE_DATE,
          people_count: 1,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
