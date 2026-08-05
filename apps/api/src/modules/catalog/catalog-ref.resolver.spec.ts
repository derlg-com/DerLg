import { ItemType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CatalogRefResolver } from './catalog-ref.resolver';

describe('CatalogRefResolver', () => {
  let prisma: {
    place: { findMany: jest.Mock };
    hotel: { findMany: jest.Mock };
    transport: { findMany: jest.Mock };
    guide: { findMany: jest.Mock };
  };
  let resolver: CatalogRefResolver;

  beforeEach(() => {
    prisma = {
      place: { findMany: jest.fn().mockResolvedValue([]) },
      hotel: { findMany: jest.fn().mockResolvedValue([]) },
      transport: { findMany: jest.fn().mockResolvedValue([]) },
      guide: { findMany: jest.fn().mockResolvedValue([]) },
    };
    resolver = new CatalogRefResolver(prisma as unknown as PrismaService);
  });

  it('batches ids by type into one query per table (no N+1)', async () => {
    prisma.place.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    prisma.hotel.findMany.mockResolvedValue([{ id: 'h1' }]);

    const resolved = await resolver.resolve([
      { type: ItemType.PLACE, refId: 'p1' },
      { type: ItemType.PLACE, refId: 'p2' },
      { type: ItemType.PLACE, refId: 'p1' },
      { type: ItemType.HOTEL, refId: 'h1' },
    ]);

    expect(prisma.place.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.hotel.findMany).toHaveBeenCalledTimes(1);
    // Duplicate ids are de-duplicated before the query.
    const placeArgs = prisma.place.findMany.mock.calls[0][0] as { where: { id: { in: string[] } } };
    expect(placeArgs.where.id.in.sort()).toEqual(['p1', 'p2']);
    expect(resolved.places.size).toBe(2);
    expect(resolved.hotels.size).toBe(1);
  });

  it('skips querying tables with no referenced ids', async () => {
    await resolver.resolve([{ type: ItemType.GUIDE, refId: 'g1' }]);

    expect(prisma.place.findMany).not.toHaveBeenCalled();
    expect(prisma.hotel.findMany).not.toHaveBeenCalled();
    expect(prisma.transport.findMany).not.toHaveBeenCalled();
    expect(prisma.guide.findMany).toHaveBeenCalledTimes(1);
  });

  it('ignores CUSTOM items and null refs entirely', async () => {
    const resolved = await resolver.resolve([
      { type: ItemType.CUSTOM, refId: null },
      { type: ItemType.CUSTOM, refId: 'ignored-even-if-present' },
      { type: ItemType.PLACE, refId: null },
    ]);

    expect(prisma.place.findMany).not.toHaveBeenCalled();
    expect(resolved.places.size).toBe(0);
  });

  describe('findMissing — the anti-hallucination guard', () => {
    it('reports ids that do not exist in the database', async () => {
      prisma.place.findMany.mockResolvedValue([{ id: 'real-place' }]);
      prisma.hotel.findMany.mockResolvedValue([]);

      const missing = await resolver.findMissing([
        { type: ItemType.PLACE, refId: 'real-place' },
        { type: ItemType.PLACE, refId: 'invented-place' },
        { type: ItemType.HOTEL, refId: 'invented-hotel' },
      ]);

      expect(missing).toEqual([
        { type: ItemType.PLACE, refId: 'invented-place' },
        { type: ItemType.HOTEL, refId: 'invented-hotel' },
      ]);
    });

    it('returns an empty list when every reference resolves', async () => {
      prisma.transport.findMany.mockResolvedValue([{ id: 't1' }]);
      prisma.guide.findMany.mockResolvedValue([{ id: 'g1' }]);

      await expect(
        resolver.findMissing([
          { type: ItemType.TRANSPORT, refId: 't1' },
          { type: ItemType.GUIDE, refId: 'g1' },
          { type: ItemType.CUSTOM, refId: null },
        ]),
      ).resolves.toEqual([]);
    });
  });

  describe('pricing and capacity lookups', () => {
    it('reads the unit price from the right column per type', async () => {
      prisma.place.findMany.mockResolvedValue([{ id: 'p1', entranceFeeCents: 3700 }]);
      prisma.hotel.findMany.mockResolvedValue([{ id: 'h1', pricePerNightCents: 5400 }]);
      prisma.transport.findMany.mockResolvedValue([{ id: 't1', pricePerSeatCents: 1800 }]);
      prisma.guide.findMany.mockResolvedValue([{ id: 'g1', pricePerDayCents: 4500 }]);

      const resolved = await resolver.resolve([
        { type: ItemType.PLACE, refId: 'p1' },
        { type: ItemType.HOTEL, refId: 'h1' },
        { type: ItemType.TRANSPORT, refId: 't1' },
        { type: ItemType.GUIDE, refId: 'g1' },
      ]);

      expect(resolver.unitPriceCents(ItemType.PLACE, 'p1', resolved)).toBe(3700);
      expect(resolver.unitPriceCents(ItemType.HOTEL, 'h1', resolved)).toBe(5400);
      expect(resolver.unitPriceCents(ItemType.TRANSPORT, 't1', resolved)).toBe(1800);
      expect(resolver.unitPriceCents(ItemType.GUIDE, 'g1', resolved)).toBe(4500);
      // CUSTOM and unknown ids are always free.
      expect(resolver.unitPriceCents(ItemType.CUSTOM, null, resolved)).toBe(0);
      expect(resolver.unitPriceCents(ItemType.PLACE, 'unknown', resolved)).toBe(0);
    });

    it('reads per-day capacity from the right column per type', async () => {
      prisma.place.findMany.mockResolvedValue([{ id: 'p1', dailyCapacity: 400 }]);
      prisma.hotel.findMany.mockResolvedValue([{ id: 'h1', roomsPerNight: 30 }]);
      prisma.transport.findMany.mockResolvedValue([{ id: 't1', seatsPerDeparture: 36 }]);
      prisma.guide.findMany.mockResolvedValue([{ id: 'g1', dailyCapacity: 1 }]);

      const resolved = await resolver.resolve([
        { type: ItemType.PLACE, refId: 'p1' },
        { type: ItemType.HOTEL, refId: 'h1' },
        { type: ItemType.TRANSPORT, refId: 't1' },
        { type: ItemType.GUIDE, refId: 'g1' },
      ]);

      expect(resolver.capacityFor(ItemType.PLACE, 'p1', resolved)).toBe(400);
      expect(resolver.capacityFor(ItemType.HOTEL, 'h1', resolved)).toBe(30);
      expect(resolver.capacityFor(ItemType.TRANSPORT, 't1', resolved)).toBe(36);
      expect(resolver.capacityFor(ItemType.GUIDE, 'g1', resolved)).toBe(1);
      expect(resolver.capacityFor(ItemType.CUSTOM, null, resolved)).toBeNull();
    });
  });
});
