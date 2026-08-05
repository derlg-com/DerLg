import { BookingStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AvailabilityService } from '../availability/availability.service';
import { PricingService } from '../availability/pricing.service';
import { CatalogRefResolver } from '../catalog/catalog-ref.resolver';
import { JourneyDraftsService } from '../journeys/journey-drafts.service';
import { BookingsService } from './bookings.service';
import {
  CANCELLABLE_STATUSES,
  HOLD_DURATION_SECONDS,
  formatReference,
  holdKey,
} from './interfaces/booking.interface';

describe('booking hold primitives', () => {
  it('holds inventory for exactly fifteen minutes', () => {
    expect(HOLD_DURATION_SECONDS).toBe(900);
  });

  it('namespaces the Redis countdown key per booking', () => {
    expect(holdKey('abc-123')).toBe('booking:hold:abc-123');
  });

  it('formats a readable, zero-padded reference', () => {
    expect(formatReference(2026, 1)).toBe('DLG-2026-0001');
    expect(formatReference(2026, 42)).toBe('DLG-2026-0042');
    expect(formatReference(2027, 12_345)).toBe('DLG-2027-12345');
  });

  it('allows cancelling only while the trip has not happened', () => {
    expect(CANCELLABLE_STATUSES).toEqual(['HOLD', 'PENDING_PAYMENT', 'CONFIRMED']);
    expect(CANCELLABLE_STATUSES).not.toContain('COMPLETED');
    expect(CANCELLABLE_STATUSES).not.toContain('EXPIRED');
  });
});

describe('BookingsService', () => {
  const now = new Date('2026-08-01T12:00:00.000Z');

  let prisma: {
    booking: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
    };
    journeyDraft: { findUniqueOrThrow: jest.Mock };
    $transaction: jest.Mock;
  };
  let redis: { set: jest.Mock; del: jest.Mock };
  let service: BookingsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);

    prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
      },
      journeyDraft: { findUniqueOrThrow: jest.fn() },
      $transaction: jest.fn(),
    };
    redis = { set: jest.fn(), del: jest.fn() };

    service = new BookingsService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      {} as unknown as AvailabilityService,
      {} as unknown as PricingService,
      {} as unknown as CatalogRefResolver,
      {} as unknown as JourneyDraftsService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('expireLapsedHolds', () => {
    it('does nothing when no hold has lapsed', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await expect(service.expireLapsedHolds()).resolves.toBe(0);
      expect(prisma.booking.updateMany).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('expires lapsed holds and drops their countdown keys', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { id: 'b1', reference: 'DLG-2026-0001' },
        { id: 'b2', reference: 'DLG-2026-0002' },
      ]);

      await expect(service.expireLapsedHolds()).resolves.toBe(2);

      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['b1', 'b2'] } },
        data: { status: BookingStatus.EXPIRED, holdExpiresAt: null },
      });
      expect(redis.del).toHaveBeenCalledWith('booking:hold:b1', 'booking:hold:b2');
    });

    it('only considers holds whose window has actually closed', async () => {
      await service.expireLapsedHolds(now);

      const where = prisma.booking.findMany.mock.calls[0][0].where as {
        status: { in: string[] };
        holdExpiresAt: { lte: Date };
      };
      expect(where.status.in).toEqual(['HOLD', 'PENDING_PAYMENT']);
      expect(where.holdExpiresAt.lte).toEqual(now);
      // A confirmed booking must never be swept.
      expect(where.status.in).not.toContain('CONFIRMED');
    });
  });

  describe('cancel', () => {
    function bookingRecord(status: BookingStatus) {
      return {
        id: 'b1',
        reference: 'DLG-2026-0001',
        userId: 'user-1',
        status,
        startDate: new Date('2027-05-01T00:00:00.000Z'),
        endDate: new Date('2027-05-03T00:00:00.000Z'),
        guests: 2,
        totalCents: 37_800,
        currency: 'USD',
        contactName: 'Sok Dara',
        contactEmail: 'sok@example.com',
        packageId: null,
        draftId: null,
        checkInCode: null,
        holdExpiresAt: new Date('2026-08-01T12:15:00.000Z'),
        confirmedAt: null,
        cancelledAt: null,
        snapshot: { title: 'Trip', packageSlug: null, days: [], price: {} },
        createdAt: now,
        updatedAt: now,
        package: null,
        items: [],
        payments: [],
      };
    }

    it('cancels a held booking and clears its countdown', async () => {
      prisma.booking.findUnique.mockResolvedValue(bookingRecord(BookingStatus.HOLD));
      prisma.booking.update.mockResolvedValue({
        ...bookingRecord(BookingStatus.CANCELLED),
        cancelledAt: now,
        holdExpiresAt: null,
      });

      const view = await service.cancel('user-1', 'b1');

      expect(view.status).toBe(BookingStatus.CANCELLED);
      expect(redis.del).toHaveBeenCalledWith('booking:hold:b1');
    });

    it.each([BookingStatus.EXPIRED, BookingStatus.CANCELLED, BookingStatus.COMPLETED])(
      'refuses to cancel a %s booking',
      async (status) => {
        prisma.booking.findUnique.mockResolvedValue(bookingRecord(status));

        await expect(service.cancel('user-1', 'b1')).rejects.toMatchObject({
          code: 'BOOKING_INVALID_STATE',
        });
        expect(prisma.booking.update).not.toHaveBeenCalled();
      },
    );

    it('hides another traveller´s booking behind a 403', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...bookingRecord(BookingStatus.HOLD),
        userId: 'someone-else',
      });

      await expect(service.cancel('user-1', 'b1')).rejects.toMatchObject({ status: 403 });
    });

    it('404s an unknown booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.cancel('user-1', 'ghost')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('toView', () => {
    it('counts down the remaining hold seconds', () => {
      const view = service.toView({
        id: 'b1',
        reference: 'DLG-2026-0001',
        userId: 'user-1',
        status: BookingStatus.HOLD,
        startDate: new Date('2027-05-01T00:00:00.000Z'),
        endDate: new Date('2027-05-03T00:00:00.000Z'),
        guests: 2,
        totalCents: 1000,
        currency: 'USD',
        contactName: 'A',
        contactEmail: 'a@b.com',
        packageId: null,
        draftId: null,
        checkInCode: null,
        // Ten minutes from "now".
        holdExpiresAt: new Date('2026-08-01T12:10:00.000Z'),
        confirmedAt: null,
        cancelledAt: null,
        snapshot: {},
        createdAt: now,
        updatedAt: now,
        package: null,
        items: [],
        payments: [],
      } as never);

      expect(view.secondsRemaining).toBe(600);
      expect(view.startDate).toBe('2027-05-01');
      expect(view.endDate).toBe('2027-05-03');
    });

    it('clamps an already-lapsed countdown to zero rather than going negative', () => {
      const view = service.toView({
        id: 'b1',
        reference: 'DLG-2026-0001',
        userId: 'user-1',
        status: BookingStatus.HOLD,
        startDate: new Date('2027-05-01T00:00:00.000Z'),
        endDate: new Date('2027-05-01T00:00:00.000Z'),
        guests: 1,
        totalCents: 0,
        currency: 'USD',
        contactName: 'A',
        contactEmail: 'a@b.com',
        packageId: null,
        draftId: null,
        checkInCode: null,
        holdExpiresAt: new Date('2026-08-01T11:00:00.000Z'),
        confirmedAt: null,
        cancelledAt: null,
        snapshot: {},
        createdAt: now,
        updatedAt: now,
        package: null,
        items: [],
        payments: [],
      } as never);

      expect(view.secondsRemaining).toBe(0);
    });

    it('reports no countdown for a confirmed booking', () => {
      const view = service.toView({
        id: 'b1',
        reference: 'DLG-2026-0001',
        userId: 'user-1',
        status: BookingStatus.CONFIRMED,
        startDate: new Date('2027-05-01T00:00:00.000Z'),
        endDate: new Date('2027-05-01T00:00:00.000Z'),
        guests: 1,
        totalCents: 0,
        currency: 'USD',
        contactName: 'A',
        contactEmail: 'a@b.com',
        packageId: null,
        draftId: null,
        checkInCode: 'A1B2C3D4',
        holdExpiresAt: null,
        confirmedAt: now,
        cancelledAt: null,
        snapshot: {},
        createdAt: now,
        updatedAt: now,
        package: null,
        items: [],
        payments: [],
      } as never);

      expect(view.secondsRemaining).toBeNull();
      expect(view.checkInCode).toBe('A1B2C3D4');
    });
  });

  describe('markConfirmed', () => {
    it('stamps a check-in code and releases the hold key', async () => {
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        reference: 'DLG-2026-0001',
        userId: 'user-1',
        status: BookingStatus.CONFIRMED,
        startDate: new Date('2027-05-01T00:00:00.000Z'),
        endDate: new Date('2027-05-01T00:00:00.000Z'),
        guests: 1,
        totalCents: 1000,
        currency: 'USD',
        contactName: 'A',
        contactEmail: 'a@b.com',
        packageId: null,
        draftId: null,
        checkInCode: 'DEADBEEF',
        holdExpiresAt: null,
        confirmedAt: now,
        cancelledAt: null,
        snapshot: {},
        createdAt: now,
        updatedAt: now,
        package: null,
        items: [],
        payments: [],
      });

      const view = await service.markConfirmed('b1');

      const data = prisma.booking.update.mock.calls[0][0].data as {
        status: string;
        checkInCode: string;
        holdExpiresAt: null;
      };
      expect(data.status).toBe(BookingStatus.CONFIRMED);
      expect(data.checkInCode).toMatch(/^[0-9A-F]{8}$/);
      expect(data.holdExpiresAt).toBeNull();
      expect(redis.del).toHaveBeenCalledWith('booking:hold:b1');
      expect(view.status).toBe(BookingStatus.CONFIRMED);
    });
  });
});
