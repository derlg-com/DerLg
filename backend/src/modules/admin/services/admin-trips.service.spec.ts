import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { AdminTripsService } from './admin-trips.service';

/**
 * Trip packages are a four-table aggregate (trip, translations, itinerary items,
 * item translations) plus an implicit many-to-many to Guide. Before this service
 * existed they could only be created by the seed script or hand-written SQL.
 *
 * These tests pin the guards that stop an admin producing a package the public
 * site cannot render or that quietly destroys booking history:
 *
 *  - publishing without an English title (English is the public fallback locale,
 *    so the card would render untitled),
 *  - itinerary days outside the trip's duration, in both directions,
 *  - a reorder that references another trip's item, which must apply nothing,
 *  - deleting a trip that bookings still point at,
 *  - and cache invalidation on every mutation, without which a successful write
 *    stays invisible on the public site until the TTL lapses.
 */
describe('AdminTripsService', () => {
  let service: AdminTripsService;
  let prisma: {
    trip: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    tripTranslation: { createMany: jest.Mock; upsert: jest.Mock };
    tripItineraryItem: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    tripItineraryItemTranslation: { createMany: jest.Mock; upsert: jest.Mock };
    guide: { findMany: jest.Mock };
    place: { findUnique: jest.Mock };
    hotel: { findUnique: jest.Mock };
    bookingItem: { count: jest.Mock };
    booking: { count: jest.Mock };
    user: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let cacheInvalidation: { invalidateTripCaches: jest.Mock };

  /** Shape returned by the detail query, which every mutation re-reads. */
  const TRIP_DETAIL = {
    id: 'trip-1',
    category: 'temples',
    durationDays: 3,
    basePriceUsd: { toString: () => '249.99' },
    maxCapacity: 12,
    coverImage: null,
    images: [],
    extras: null,
    isPublished: false,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-02'),
    translations: [{ id: 't-en', language: 'en', title: 'Angkor Deep Dive' }],
    itineraryItems: [],
    guides: [],
    _count: { reviews: 0, bookingItems: 0 },
  };

  beforeEach(() => {
    prisma = {
      trip: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(TRIP_DETAIL),
        create: jest.fn().mockResolvedValue({ id: 'trip-1' }),
        update: jest.fn().mockResolvedValue({ id: 'trip-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'trip-1' }),
      },
      tripTranslation: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      tripItineraryItem: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'item-1' }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'item-1' }),
        update: jest.fn().mockResolvedValue({ id: 'item-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'item-1' }),
      },
      tripItineraryItemTranslation: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      guide: { findMany: jest.fn().mockResolvedValue([]) },
      place: { findUnique: jest.fn().mockResolvedValue({ id: 'place-1' }) },
      hotel: { findUnique: jest.fn().mockResolvedValue({ id: 'hotel-1' }) },
      bookingItem: { count: jest.fn().mockResolvedValue(0) },
      booking: { count: jest.fn().mockResolvedValue(0) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      // Supports both call styles the service uses: a callback for interactive
      // transactions and an array for the batched reorder.
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(prisma)
          : Promise.resolve([]),
      ),
    };
    cacheInvalidation = {
      invalidateTripCaches: jest.fn().mockResolvedValue(undefined),
    };
    service = new AdminTripsService(
      prisma as never,
      cacheInvalidation as never,
    );
  });

  describe('listTrips', () => {
    it('should reach through the translation relation when searching', async () => {
      await service.listTrips({ search: 'angkor' });

      const where = prisma.trip.findMany.mock.calls[0][0].where;
      // Titles live on translation rows, not the trip, so a top-level filter
      // would silently match nothing.
      expect(where.translations.some.title).toEqual({
        contains: 'angkor',
        mode: 'insensitive',
      });
    });

    it('should treat an absent isPublished as "both" rather than defaulting to drafts', async () => {
      await service.listTrips({});

      expect(
        prisma.trip.findMany.mock.calls[0][0].where.isPublished,
      ).toBeUndefined();
    });

    it('should cap limit at 100 and compute pagination metadata', async () => {
      prisma.trip.count.mockResolvedValue(45);

      const result = await service.listTrips({ page: 2, limit: 500 });

      expect(prisma.trip.findMany.mock.calls[0][0].take).toBe(100);
      expect(prisma.trip.findMany.mock.calls[0][0].skip).toBe(100);
      expect(result.meta).toEqual({
        page: 2,
        limit: 100,
        total: 45,
        totalPages: 1,
      });
    });
  });

  describe('getTripById', () => {
    it('should 404 for an unknown trip', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(service.getTripById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should resolve guide names via a second query, since Guide has no user relation', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        ...TRIP_DETAIL,
        guides: [
          { id: 'g-1', userId: 'u-1', isActive: true, province: 'Siem Reap' },
        ],
      });
      prisma.user.findMany.mockResolvedValue([
        { id: 'u-1', fullName: 'Dara', email: 'dara@derlg.demo' },
      ]);

      const trip = await service.getTripById('trip-1');

      expect(trip.guides[0]).toMatchObject({
        id: 'g-1',
        fullName: 'Dara',
        email: 'dara@derlg.demo',
      });
    });
  });

  describe('createTrip', () => {
    const base = {
      category: 'temples' as never,
      durationDays: 3,
      basePriceUsd: 249.99,
      translations: [{ language: 'en' as never, title: 'Angkor Deep Dive' }],
    };

    it('should write the trip and its translations in one transaction', async () => {
      await service.createTrip(base);

      // A trip whose translations failed to write would have no title in any
      // language: invisible, yet occupying an id.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.trip.create).toHaveBeenCalled();
      expect(prisma.tripTranslation.createMany).toHaveBeenCalled();
    });

    it('should reject a duplicated language', async () => {
      await expect(
        service.createTrip({
          ...base,
          translations: [
            { language: 'en', title: 'A' },
            { language: 'en', title: 'B' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should refuse to create as published without an English title', async () => {
      await expect(
        service.createTrip({
          ...base,
          isPublished: true,
          translations: [{ language: 'zh', title: '仅中文' }],
        }),
      ).rejects.toThrow(/English \(en\) title/);
    });

    it('should invalidate the public catalogue cache', async () => {
      await service.createTrip(base);

      expect(cacheInvalidation.invalidateTripCaches).toHaveBeenCalledWith(
        'trip-1',
      );
    });
  });

  describe('updateTrip', () => {
    beforeEach(() => {
      // Spread TRIP_DETAIL: updateTrip re-reads via getTripById, which maps
      // `guides` and `translations`, so a minimal stub would throw on .map().
      prisma.trip.findUnique.mockResolvedValue({
        ...TRIP_DETAIL,
        durationDays: 3,
        translations: [{ language: 'en', title: 'Angkor Deep Dive' }],
      });
    });

    it('should upsert a missing language instead of replacing the set', async () => {
      await service.updateTrip('trip-1', {
        translations: [{ language: 'zh', title: '吴哥深度游' }],
      });

      // Upsert on [tripId, language] leaves languages absent from the payload
      // untouched — a PATCH carrying only Chinese must not delete English.
      expect(prisma.tripTranslation.upsert).toHaveBeenCalledTimes(1);
      const call = prisma.tripTranslation.upsert.mock.calls[0][0];
      expect(call.where.tripId_language).toEqual({
        tripId: 'trip-1',
        language: 'zh',
      });
    });

    it('should refuse to shorten a trip below an existing itinerary day', async () => {
      prisma.tripItineraryItem.count.mockResolvedValue(2);

      await expect(
        service.updateTrip('trip-1', { durationDays: 1 }),
      ).rejects.toThrow(/2 itinerary item\(s\) fall on later days/);
    });

    it('should allow shortening when no itinerary item is orphaned', async () => {
      prisma.tripItineraryItem.count.mockResolvedValue(0);

      await expect(
        service.updateTrip('trip-1', { durationDays: 1 }),
      ).resolves.toBeDefined();
    });

    it('should count an incoming English title when publishing in the same request', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        ...TRIP_DETAIL,
        durationDays: 3,
        // Stored copy has no English row yet.
        translations: [{ language: 'zh', title: '吴哥' }],
      });

      // Supplying English and isPublished together must succeed: the merge check
      // lets the incoming payload satisfy the requirement.
      await expect(
        service.updateTrip('trip-1', {
          isPublished: true,
          translations: [{ language: 'en', title: 'Angkor' }],
        }),
      ).resolves.toBeDefined();
    });

    it('should 404 for an unknown trip', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(service.updateTrip('missing', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setPublished', () => {
    it('should refuse publishing when the English title is blank', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        ...TRIP_DETAIL,
        translations: [{ language: 'en', title: '   ' }],
      });

      await expect(service.setPublished('trip-1', true)).rejects.toThrow(
        /English \(en\) title/,
      );
    });

    it('should always allow unpublishing, even without an English title', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        ...TRIP_DETAIL,
        translations: [],
      });

      await expect(
        service.setPublished('trip-1', false),
      ).resolves.toBeDefined();
    });
  });

  describe('itinerary', () => {
    beforeEach(() => {
      prisma.trip.findUnique.mockResolvedValue({
        ...TRIP_DETAIL,
        durationDays: 3,
      });
    });

    it('should reject a day beyond the trip duration', async () => {
      await expect(
        service.createItineraryItem('trip-1', {
          dayNumber: 9,
          translations: [{ language: 'en', title: 'Too late' }],
        }),
      ).rejects.toThrow(/exceeds the trip duration of 3 day\(s\)/);
    });

    it('should reject an unknown placeId before touching the database', async () => {
      prisma.place.findUnique.mockResolvedValue(null);

      await expect(
        service.createItineraryItem('trip-1', {
          dayNumber: 1,
          placeId: 'ghost',
          translations: [{ language: 'en', title: 'Ghost stop' }],
        }),
      ).rejects.toThrow(/Unknown placeId/);
      // Both FKs are ON DELETE SET NULL, so a bad id would otherwise surface as
      // an opaque Prisma foreign-key error rather than a useful message.
      expect(prisma.tripItineraryItem.create).not.toHaveBeenCalled();
    });

    it('should 404 when an item belongs to a different trip', async () => {
      prisma.tripItineraryItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateItineraryItem('trip-1', 'foreign-item', { sortOrder: 1 }),
      ).rejects.toThrow(/not found on trip trip-1/);
    });

    it("should reject a reorder containing another trip's item and write nothing", async () => {
      // Only one of the two ids belongs to this trip.
      prisma.tripItineraryItem.findMany.mockResolvedValue([{ id: 'item-1' }]);

      await expect(
        service.reorderItinerary('trip-1', {
          items: [
            { itemId: 'item-1', dayNumber: 1, sortOrder: 0 },
            { itemId: 'foreign', dayNumber: 1, sortOrder: 1 },
          ],
        }),
      ).rejects.toThrow(NotFoundException);

      // Ownership is verified before any write, so a bad payload cannot apply
      // partially and leave the itinerary half-reordered.
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.tripItineraryItem.update).not.toHaveBeenCalled();
    });

    it('should reject duplicate itemIds in a reorder payload', async () => {
      await expect(
        service.reorderItinerary('trip-1', {
          items: [
            { itemId: 'item-1', dayNumber: 1, sortOrder: 0 },
            { itemId: 'item-1', dayNumber: 1, sortOrder: 1 },
          ],
        }),
      ).rejects.toThrow(/duplicate itemIds/);
    });

    it('should apply a valid reorder as a single transaction', async () => {
      prisma.tripItineraryItem.findMany.mockResolvedValue([
        { id: 'item-1' },
        { id: 'item-2' },
      ]);

      await service.reorderItinerary('trip-1', {
        items: [
          { itemId: 'item-1', dayNumber: 1, sortOrder: 1 },
          { itemId: 'item-2', dayNumber: 1, sortOrder: 0 },
        ],
      });

      // One transaction, so the itinerary is never observable mid-reorder.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('setTripGuides', () => {
    it('should reject unknown guide ids', async () => {
      prisma.guide.findMany.mockResolvedValue([]);

      await expect(
        service.setTripGuides('trip-1', { guideIds: ['ghost'] }),
      ).rejects.toThrow(/Unknown guide id\(s\): ghost/);
    });

    it('should reject inactive guides', async () => {
      prisma.guide.findMany.mockResolvedValue([{ id: 'g-1', isActive: false }]);

      await expect(
        service.setTripGuides('trip-1', { guideIds: ['g-1'] }),
      ).rejects.toThrow(/Cannot assign inactive guide\(s\)/);
    });

    it('should replace the whole relation so unchecking removes a guide', async () => {
      prisma.guide.findMany.mockResolvedValue([{ id: 'g-1', isActive: true }]);

      await service.setTripGuides('trip-1', { guideIds: ['g-1'] });

      expect(prisma.trip.update.mock.calls[0][0].data.guides).toEqual({
        set: [{ id: 'g-1' }],
      });
    });

    it('should accept an empty list as "remove all"', async () => {
      await service.setTripGuides('trip-1', { guideIds: [] });

      expect(prisma.guide.findMany).not.toHaveBeenCalled();
      expect(prisma.trip.update.mock.calls[0][0].data.guides).toEqual({
        set: [],
      });
    });
  });

  describe('deleteTrip', () => {
    it('should refuse deletion when booking items reference the trip', async () => {
      prisma.bookingItem.count.mockResolvedValue(3);

      await expect(service.deleteTrip('trip-1')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.trip.delete).not.toHaveBeenCalled();
    });

    it('should refuse deletion when a booking uses the trip as its template', async () => {
      // The Booking FK is ON DELETE SET NULL, so Postgres would happily null it
      // and silently erase which package was booked. Hence an explicit guard.
      prisma.booking.count.mockResolvedValue(2);

      await expect(service.deleteTrip('trip-1')).rejects.toThrow(
        /2 booking record\(s\)/,
      );
      expect(prisma.trip.delete).not.toHaveBeenCalled();
    });

    it('should report both reference counts in the conflict message', async () => {
      prisma.bookingItem.count.mockResolvedValue(3);
      prisma.booking.count.mockResolvedValue(2);

      await expect(service.deleteTrip('trip-1')).rejects.toThrow(
        /5 booking record\(s\) \(3 booking item\(s\), 2 booking template\(s\)\)/,
      );
    });

    it('should hard-delete an unreferenced trip and invalidate the cache', async () => {
      const result = await service.deleteTrip('trip-1');

      expect(prisma.trip.delete).toHaveBeenCalledWith({
        where: { id: 'trip-1' },
      });
      expect(cacheInvalidation.invalidateTripCaches).toHaveBeenCalledWith(
        'trip-1',
      );
      expect(result).toEqual({ id: 'trip-1', deleted: true });
    });

    it('should 404 for an unknown trip', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(service.deleteTrip('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createAuditLog', () => {
    it('should swallow a logging failure rather than failing the mutation', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.createAuditLog({
          eventType: 'admin_action',
          entityType: 'TRIP',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
