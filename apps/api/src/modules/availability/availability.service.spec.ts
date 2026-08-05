import { ItemType } from '@prisma/client';

import { ErrorCode } from '../../common/errors/error-codes';
import { CatalogRefResolver } from '../catalog/catalog-ref.resolver';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from './availability.service';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { addDays, toDateOnly } from './interfaces/availability.interface';
import { PricingService } from './pricing.service';

type GroupByRow = { type: ItemType; refId: string | null; date: Date; _sum: { quantity: number } };

interface PrismaMock {
  place: { findMany: jest.Mock };
  hotel: { findMany: jest.Mock };
  transport: { findMany: jest.Mock };
  guide: { findMany: jest.Mock };
  package: { findUnique: jest.Mock };
  bookingItem: { groupBy: jest.Mock };
}

function makePrisma(): PrismaMock {
  return {
    place: { findMany: jest.fn().mockResolvedValue([]) },
    hotel: { findMany: jest.fn().mockResolvedValue([]) },
    transport: { findMany: jest.fn().mockResolvedValue([]) },
    guide: { findMany: jest.fn().mockResolvedValue([]) },
    package: { findUnique: jest.fn().mockResolvedValue(null) },
    bookingItem: { groupBy: jest.fn().mockResolvedValue([]) },
  };
}

function dto(overrides: Partial<CheckAvailabilityDto> = {}): CheckAvailabilityDto {
  return Object.assign(new CheckAvailabilityDto(), {
    startDate: '2026-09-01',
    guests: 2,
    items: [],
    ...overrides,
  });
}

describe('date helpers', () => {
  it('adds whole UTC days without drifting', () => {
    const start = new Date('2026-09-01T00:00:00.000Z');

    expect(toDateOnly(addDays(start, 0))).toBe('2026-09-01');
    expect(toDateOnly(addDays(start, 3))).toBe('2026-09-04');
    // Month boundary
    expect(toDateOnly(addDays(new Date('2026-09-30T00:00:00.000Z'), 1))).toBe('2026-10-01');
  });
});

describe('AvailabilityService', () => {
  let prisma: PrismaMock;
  let service: AvailabilityService;

  beforeEach(() => {
    prisma = makePrisma();
    const refs = new CatalogRefResolver(prisma as unknown as PrismaService);
    service = new AvailabilityService(
      prisma as unknown as PrismaService,
      refs,
      new PricingService(refs),
    );
  });

  function seedCatalogue() {
    prisma.hotel.findMany.mockResolvedValue([
      {
        id: 'hotel-1',
        slug: 'lotus-lodge',
        name: 'Lotus Lodge',
        pricePerNightCents: 2800,
        roomsPerNight: 2,
        city: { slug: 'siem-reap', name: 'Siem Reap' },
      },
    ]);
    prisma.transport.findMany.mockResolvedValue([
      {
        id: 'transport-1',
        slug: 'bus-1',
        operator: 'Giant Ibis',
        departureTime: '08:00',
        pricePerSeatCents: 1800,
        seatsPerDeparture: 4,
        originCity: { slug: 'phnom-penh', name: 'Phnom Penh' },
        destinationCity: { slug: 'siem-reap', name: 'Siem Reap' },
      },
    ]);
    prisma.place.findMany.mockResolvedValue([
      { id: 'place-1', slug: 'angkor-wat', name: 'Angkor Wat', entranceFeeCents: 3700, dailyCapacity: 400 },
    ]);
  }

  describe('check', () => {
    it('treats CUSTOM free time as always available and never charges for it', async () => {
      const result = await service.check(
        dto({
          items: [
            { dayNumber: 2, type: 'CUSTOM', title: 'Pool afternoon', bookable: false, itemKey: 'k1' },
          ],
        }),
      );

      expect(result.availability.available).toBe(true);
      expect(result.availability.items[0]).toMatchObject({
        itemKey: 'k1',
        date: '2026-09-02',
        requested: 0,
        capacity: null,
        available: true,
      });
      expect(result.price.totalCents).toBe(0);
      // No inventory query is needed when nothing is bookable.
      expect(prisma.bookingItem.groupBy).not.toHaveBeenCalled();
    });

    it('maps each day number onto a real calendar date', async () => {
      seedCatalogue();

      const result = await service.check(
        dto({
          items: [
            { dayNumber: 1, type: 'PLACE', refId: 'place-1', title: 'Angkor Wat' },
            { dayNumber: 3, type: 'PLACE', refId: 'place-1', title: 'Angkor Wat again' },
          ],
        }),
      );

      expect(result.availability.items.map((item) => item.date)).toEqual(['2026-09-01', '2026-09-03']);
      expect(result.availability.endDate).toBe('2026-09-03');
    });

    it('reports availability when capacity comfortably covers the party', async () => {
      seedCatalogue();

      const result = await service.check(
        dto({
          guests: 2,
          items: [{ dayNumber: 1, type: 'HOTEL', refId: 'hotel-1', title: 'Lotus Lodge' }],
        }),
      );

      expect(result.availability.items[0]).toMatchObject({
        requested: 1,
        capacity: 2,
        alreadyBooked: 0,
        remaining: 2,
        available: true,
      });
      expect(result.availability.available).toBe(true);
    });

    it('subtracts inventory already held by other bookings', async () => {
      seedCatalogue();
      prisma.bookingItem.groupBy.mockResolvedValue([
        {
          type: ItemType.HOTEL,
          refId: 'hotel-1',
          date: new Date('2026-09-01T00:00:00.000Z'),
          _sum: { quantity: 1 },
        },
      ] satisfies GroupByRow[]);

      const result = await service.check(
        dto({
          guests: 2,
          items: [{ dayNumber: 1, type: 'HOTEL', refId: 'hotel-1', title: 'Lotus Lodge' }],
        }),
      );

      expect(result.availability.items[0]).toMatchObject({
        capacity: 2,
        alreadyBooked: 1,
        remaining: 1,
        available: true,
      });
    });

    it('marks an item unavailable when the request exceeds what is left', async () => {
      seedCatalogue();
      prisma.bookingItem.groupBy.mockResolvedValue([
        {
          type: ItemType.TRANSPORT,
          refId: 'transport-1',
          date: new Date('2026-09-01T00:00:00.000Z'),
          _sum: { quantity: 3 },
        },
      ]);

      const result = await service.check(
        dto({
          guests: 2,
          items: [{ dayNumber: 1, type: 'TRANSPORT', refId: 'transport-1', title: 'Bus' }],
        }),
      );

      expect(result.availability.items[0]).toMatchObject({
        requested: 2,
        capacity: 4,
        alreadyBooked: 3,
        remaining: 1,
        available: false,
        reason: 'CAPACITY_EXCEEDED',
      });
      expect(result.availability.available).toBe(false);
      expect(result.availability.unavailableCount).toBe(1);
    });

    it('reports SOLD_OUT when nothing at all is left', async () => {
      seedCatalogue();
      prisma.bookingItem.groupBy.mockResolvedValue([
        {
          type: ItemType.HOTEL,
          refId: 'hotel-1',
          date: new Date('2026-09-01T00:00:00.000Z'),
          _sum: { quantity: 2 },
        },
      ]);

      const result = await service.check(
        dto({ items: [{ dayNumber: 1, type: 'HOTEL', refId: 'hotel-1', title: 'Lotus Lodge' }] }),
      );

      expect(result.availability.items[0]).toMatchObject({ remaining: 0, reason: 'SOLD_OUT' });
    });

    it('flags a reference that does not exist — the anti-hallucination path', async () => {
      const result = await service.check(
        dto({
          items: [{ dayNumber: 1, type: 'HOTEL', refId: 'ffffffff-0000-0000-0000-000000000000', title: 'Invented Hotel' }],
        }),
      );

      expect(result.availability.items[0]).toMatchObject({
        available: false,
        reason: 'MISSING_REFERENCE',
      });
      expect(result.availability.available).toBe(false);
    });

    it('only counts inventory-holding booking statuses', async () => {
      seedCatalogue();

      await service.check(
        dto({ items: [{ dayNumber: 1, type: 'HOTEL', refId: 'hotel-1', title: 'Lotus Lodge' }] }),
      );

      const where = prisma.bookingItem.groupBy.mock.calls[0][0].where as {
        booking: { status: { in: string[] } };
      };
      expect(where.booking.status.in).toEqual(['HOLD', 'PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED']);
      // Expired and cancelled bookings must release their stock automatically.
      expect(where.booking.status.in).not.toContain('EXPIRED');
      expect(where.booking.status.in).not.toContain('CANCELLED');
    });

    it('can exclude a booking so re-checking its own hold succeeds', async () => {
      seedCatalogue();

      await service.check(
        dto({
          items: [{ dayNumber: 1, type: 'HOTEL', refId: 'hotel-1', title: 'Lotus Lodge' }],
          excludeBookingId: '11111111-1111-1111-1111-111111111111',
        }),
      );

      const where = prisma.bookingItem.groupBy.mock.calls[0][0].where as {
        booking: { id?: { not: string } };
      };
      expect(where.booking.id).toEqual({ not: '11111111-1111-1111-1111-111111111111' });
    });

    it('loads inventory in a single grouped query regardless of item count', async () => {
      seedCatalogue();

      await service.check(
        dto({
          items: [
            { dayNumber: 1, type: 'HOTEL', refId: 'hotel-1', title: 'A' },
            { dayNumber: 2, type: 'HOTEL', refId: 'hotel-1', title: 'B' },
            { dayNumber: 3, type: 'PLACE', refId: 'place-1', title: 'C' },
          ],
        }),
      );

      expect(prisma.bookingItem.groupBy).toHaveBeenCalledTimes(1);
    });

    it('suggests same-city alternatives with room when a hotel is full', async () => {
      prisma.hotel.findMany
        // First call: CatalogRefResolver loading the requested hotel.
        .mockResolvedValueOnce([
          {
            id: 'hotel-full',
            slug: 'full-hotel',
            name: 'Full Hotel',
            pricePerNightCents: 5000,
            roomsPerNight: 1,
            city: { slug: 'siem-reap', name: 'Siem Reap' },
          },
        ])
        // Second call: alternatives lookup.
        .mockResolvedValueOnce([
          { id: 'hotel-alt', slug: 'alt-hotel', name: 'Alt Hotel', pricePerNightCents: 4200, roomsPerNight: 10 },
          { id: 'hotel-tiny', slug: 'tiny-hotel', name: 'Tiny Hotel', pricePerNightCents: 3000, roomsPerNight: 0 },
        ]);
      prisma.bookingItem.groupBy
        .mockResolvedValueOnce([
          {
            type: ItemType.HOTEL,
            refId: 'hotel-full',
            date: new Date('2026-09-01T00:00:00.000Z'),
            _sum: { quantity: 1 },
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.check(
        dto({ items: [{ dayNumber: 1, type: 'HOTEL', refId: 'hotel-full', title: 'Full Hotel' }] }),
      );

      const [item] = result.availability.items;
      expect(item.available).toBe(false);
      expect(item.alternatives).toEqual([
        { refId: 'hotel-alt', slug: 'alt-hotel', label: 'Alt Hotel', priceCents: 4200, remaining: 10 },
      ]);
      // A zero-capacity candidate is not offered as an alternative.
      expect(item.alternatives.map((alt) => alt.refId)).not.toContain('hotel-tiny');
    });

    it('prices the itinerary against a package basis when one is given', async () => {
      seedCatalogue();
      prisma.package.findUnique.mockResolvedValue({
        id: 'pkg-1',
        pricingMode: 'PER_PERSON',
        basePriceCents: 18_900,
        minGroupSize: 1,
        maxGroupSize: 16,
      });

      const result = await service.check(
        dto({
          guests: 2,
          packageId: '22222222-2222-2222-2222-222222222222',
          items: [{ dayNumber: 1, type: 'PLACE', refId: 'place-1', title: 'Angkor Wat' }],
        }),
      );

      expect(result.price.baseCents).toBe(37_800);
      expect(result.price.lines).toHaveLength(1);
    });

    it('rejects a malformed start date', async () => {
      await expect(service.check(dto({ startDate: '2026-13-45' }))).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_FAILED,
      });
    });
  });

  describe('confirm', () => {
    it('returns the same report as check when everything is available', async () => {
      seedCatalogue();

      const result = await service.confirm(
        dto({ items: [{ dayNumber: 1, type: 'HOTEL', refId: 'hotel-1', title: 'Lotus Lodge' }] }),
      );

      expect(result.availability.available).toBe(true);
    });

    it('throws AVAILABILITY_UNAVAILABLE with the offending items attached', async () => {
      seedCatalogue();
      prisma.bookingItem.groupBy.mockResolvedValue([
        {
          type: ItemType.HOTEL,
          refId: 'hotel-1',
          date: new Date('2026-09-01T00:00:00.000Z'),
          _sum: { quantity: 2 },
        },
      ]);

      const caught = await service
        .confirm(dto({ items: [{ dayNumber: 1, type: 'HOTEL', refId: 'hotel-1', title: 'Lotus Lodge' }] }))
        .then(() => null)
        .catch((error: unknown) => error as { code: string; details?: Record<string, unknown> });

      expect(caught).not.toBeNull();
      expect(caught!.code).toBe(ErrorCode.AVAILABILITY_UNAVAILABLE);
      const items = caught!.details?.items as Array<{ refId: string }>;
      expect(items).toHaveLength(1);
      expect(items[0].refId).toBe('hotel-1');
    });
  });
});
