import { NotFoundException } from '@nestjs/common';
import { ItemType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CatalogRefResolver } from './catalog-ref.resolver';
import { CatalogService } from './catalog.service';
import { ListPackagesQueryDto, PackageSort } from './dto/list-packages.query.dto';
import { ListGuidesQueryDto, ListHotelsQueryDto } from './dto/list-resources.query.dto';

type PrismaMock = {
  package: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
  place: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
  hotel: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
  transport: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
  guide: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
  city: { findMany: jest.Mock };
};

function makePrisma(): PrismaMock {
  const model = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findUnique: jest.fn().mockResolvedValue(null),
  });
  return {
    package: model(),
    place: model(),
    hotel: model(),
    transport: model(),
    guide: model(),
    city: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

/** Pass-through cache so tests assert query construction, not Redis. */
function makeRedis(): { remember: jest.Mock; delByPattern: jest.Mock } {
  return {
    remember: jest.fn((_key: string, _ttl: number, factory: () => Promise<unknown>) => factory()),
    delByPattern: jest.fn().mockResolvedValue(3),
  };
}

function queryFrom<T extends object>(Dto: new () => T, overrides: Partial<T>): T {
  return Object.assign(new Dto(), overrides);
}

describe('CatalogService', () => {
  let prisma: PrismaMock;
  let redis: ReturnType<typeof makeRedis>;
  let refs: CatalogRefResolver;
  let service: CatalogService;

  beforeEach(() => {
    prisma = makePrisma();
    redis = makeRedis();
    refs = new CatalogRefResolver(prisma as unknown as PrismaService);
    service = new CatalogService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      refs,
    );
  });

  describe('listPackages', () => {
    it('applies no filters by default and pages with 20 per page', async () => {
      prisma.package.count.mockResolvedValue(41);

      const result = await service.listPackages(new ListPackagesQueryDto());

      const args = prisma.package.findMany.mock.calls[0][0] as {
        where: object;
        skip: number;
        take: number;
        select: object;
      };
      expect(args.where).toEqual({});
      expect(args.skip).toBe(0);
      expect(args.take).toBe(20);
      // Explicit select — never an implicit full-row fetch.
      expect(args.select).toBeDefined();
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 41, totalPages: 3 });
    });

    it('translates every filter into the Prisma where clause', async () => {
      const query = queryFrom(ListPackagesQueryDto, {
        city: 'siem-reap',
        kind: 'PRIVATE' as const,
        minDays: 3,
        maxDays: 5,
        minPrice: 100,
        maxPrice: 500,
        kidFriendly: 'true',
        featured: 'false',
        q: 'temple',
      });

      await service.listPackages(query);

      const { where } = prisma.package.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(where).toMatchObject({
        city: { slug: 'siem-reap' },
        kind: 'PRIVATE',
        kidFriendly: true,
        featured: false,
        durationDays: { gte: 3, lte: 5 },
        // Dollars in the query become cents in the database.
        basePriceCents: { gte: 10_000, lte: 50_000 },
      });
      expect(where.OR).toEqual([
        { title: { contains: 'temple', mode: 'insensitive' } },
        { summary: { contains: 'temple', mode: 'insensitive' } },
      ]);
    });

    it('treats kidFriendly=false as a filter rather than absent', async () => {
      await service.listPackages(queryFrom(ListPackagesQueryDto, { kidFriendly: 'false' }));

      const { where } = prisma.package.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(where.kidFriendly).toBe(false);
    });

    it('computes skip from page and limit', async () => {
      await service.listPackages(queryFrom(ListPackagesQueryDto, { page: 3, limit: 15 }));

      const args = prisma.package.findMany.mock.calls[0][0] as { skip: number; take: number };
      expect(args.skip).toBe(30);
      expect(args.take).toBe(15);
    });

    it.each([
      [PackageSort.Featured, [{ featured: 'desc' }, { title: 'asc' }]],
      [PackageSort.PriceAsc, [{ basePriceCents: 'asc' }, { title: 'asc' }]],
      [PackageSort.PriceDesc, [{ basePriceCents: 'desc' }, { title: 'asc' }]],
      [PackageSort.DurationAsc, [{ durationDays: 'asc' }, { basePriceCents: 'asc' }]],
      [PackageSort.Newest, [{ createdAt: 'desc' }]],
    ])('maps sort=%s to the right orderBy', async (sort, expected) => {
      await service.listPackages(queryFrom(ListPackagesQueryDto, { sort }));

      const { orderBy } = prisma.package.findMany.mock.calls[0][0] as { orderBy: unknown };
      expect(orderBy).toEqual(expected);
    });

    it('caches under a key derived from the query values', async () => {
      await service.listPackages(queryFrom(ListPackagesQueryDto, { city: 'siem-reap', page: 2 }));

      const [key, ttl] = redis.remember.mock.calls[0] as [string, number];
      expect(key).toBe('catalog:packages:city=siem-reap&limit=20&page=2&sort=featured');
      expect(ttl).toBe(300);
    });
  });

  describe('getPackageBySlug', () => {
    it('throws NotFound for an unknown slug', async () => {
      prisma.package.findUnique.mockResolvedValue(null);

      await expect(service.getPackageBySlug('ghost')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('resolves each day item to its catalogue row and leaves CUSTOM items unresolved', async () => {
      prisma.package.findUnique.mockResolvedValue({
        id: 'pkg-1',
        slug: 'p',
        title: 'P',
        days: [
          {
            id: 'day-1',
            dayNumber: 1,
            title: 'Day one',
            summary: 's',
            items: [
              {
                id: 'i1',
                position: 0,
                type: ItemType.PLACE,
                refId: 'place-1',
                title: 'Temple',
                description: '',
                startTime: '08:00',
                durationMinutes: 60,
                priceCents: 0,
                bookable: true,
              },
              {
                id: 'i2',
                position: 1,
                type: ItemType.HOTEL,
                refId: 'hotel-1',
                title: 'Hotel',
                description: '',
                startTime: null,
                durationMinutes: 60,
                priceCents: 0,
                bookable: true,
              },
              {
                id: 'i3',
                position: 2,
                type: ItemType.CUSTOM,
                refId: null,
                title: 'Free afternoon',
                description: '',
                startTime: null,
                durationMinutes: 120,
                priceCents: 0,
                bookable: false,
              },
            ],
          },
        ],
      });
      prisma.place.findMany.mockResolvedValue([{ id: 'place-1', name: 'Angkor Wat' }]);
      prisma.hotel.findMany.mockResolvedValue([{ id: 'hotel-1', name: 'Lotus Lodge' }]);

      const result = await service.getPackageBySlug('p');
      const items = result.days[0].items;

      expect(items[0].reference).toEqual({ kind: 'PLACE', place: { id: 'place-1', name: 'Angkor Wat' } });
      expect(items[1].reference).toEqual({ kind: 'HOTEL', hotel: { id: 'hotel-1', name: 'Lotus Lodge' } });
      expect(items[2].reference).toBeNull();
      expect(items[2].bookable).toBe(false);
    });

    it('returns a null reference rather than throwing when a ref no longer exists', async () => {
      prisma.package.findUnique.mockResolvedValue({
        slug: 'p',
        days: [
          {
            id: 'day-1',
            dayNumber: 1,
            title: 't',
            summary: 's',
            items: [
              {
                id: 'i1',
                position: 0,
                type: ItemType.PLACE,
                refId: 'deleted-place',
                title: 'Gone',
                description: '',
                startTime: null,
                durationMinutes: 30,
                priceCents: 0,
                bookable: true,
              },
            ],
          },
        ],
      });
      prisma.place.findMany.mockResolvedValue([]);

      const result = await service.getPackageBySlug('p');

      expect(result.days[0].items[0].reference).toBeNull();
    });
  });

  describe('resource filters', () => {
    it('converts hotel maxPrice dollars into cents and filters by stars', async () => {
      await service.listHotels(
        queryFrom(ListHotelsQueryDto, { city: 'phnom-penh', maxPrice: 70, minStars: 3 }),
      );

      const { where } = prisma.hotel.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(where).toEqual({
        city: { slug: 'phnom-penh' },
        pricePerNightCents: { lte: 7000 },
        starRating: { gte: 3 },
      });
    });

    it('filters guides by spoken language using an array containment check', async () => {
      await service.listGuides(queryFrom(ListGuidesQueryDto, { language: 'Mandarin' }));

      const { where } = prisma.guide.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(where).toEqual({ languages: { has: 'Mandarin' } });
    });
  });

  describe('invalidate', () => {
    it('drops every catalogue cache key', async () => {
      await service.invalidate();

      expect(redis.delByPattern).toHaveBeenCalledWith('catalog:*');
    });
  });

  describe('cache resilience', () => {
    it('reads through to Postgres when Redis is unavailable', async () => {
      redis.remember.mockRejectedValue(new Error('ECONNREFUSED'));
      prisma.package.count.mockResolvedValue(1);
      prisma.package.findMany.mockResolvedValue([{ id: 'p1' }]);

      const result = await service.listPackages(new ListPackagesQueryDto());

      expect(result.items).toEqual([{ id: 'p1' }]);
    });

    it('still surfaces NotFound rather than masking it as a cache failure', async () => {
      redis.remember.mockImplementation((_k: string, _t: number, factory: () => Promise<unknown>) =>
        factory(),
      );
      prisma.place.findUnique.mockResolvedValue(null);

      await expect(service.getPlaceBySlug('ghost')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
