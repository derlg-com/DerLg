import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ItemType, Prisma } from '@prisma/client';

import { Paginated, paginate } from '../../common/interfaces/api-response.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CatalogRefResolver } from './catalog-ref.resolver';
import { ListPackagesQueryDto, PackageSort } from './dto/list-packages.query.dto';
import {
  ListGuidesQueryDto,
  ListHotelsQueryDto,
  ListPlacesQueryDto,
  ListTransportsQueryDto,
} from './dto/list-resources.query.dto';
import {
  CITY_SELECT,
  CityRecord,
  GUIDE_SELECT,
  GuideRecord,
  HOTEL_SELECT,
  HotelRecord,
  PACKAGE_DETAIL_SELECT,
  PACKAGE_SUMMARY_SELECT,
  PLACE_DETAIL_SELECT,
  PLACE_SUMMARY_SELECT,
  PackageDetail,
  PackageSummary,
  PlaceDetail,
  PlaceSummary,
  ResolvedDayItem,
  TRANSPORT_SELECT,
  TransportRecord,
} from './interfaces/catalog.interface';

/** Catalogue data changes rarely, so a five-minute TTL is generous and safe. */
const CACHE_TTL_SECONDS = 300;
const CACHE_PREFIX = 'catalog';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly refs: CatalogRefResolver,
  ) {}

  // ------------------------------------------------------------- packages

  listPackages(query: ListPackagesQueryDto): Promise<Paginated<PackageSummary>> {
    return this.cached(this.keyFor('packages', query), () => this.queryPackages(query));
  }

  private async queryPackages(query: ListPackagesQueryDto): Promise<Paginated<PackageSummary>> {
    const where: Prisma.PackageWhereInput = {
      ...(query.city ? { city: { slug: query.city } } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.kidFriendly !== undefined ? { kidFriendly: query.kidFriendly === 'true' } : {}),
      ...(query.featured !== undefined ? { featured: query.featured === 'true' } : {}),
      ...(query.minDays || query.maxDays
        ? {
            durationDays: {
              ...(query.minDays ? { gte: query.minDays } : {}),
              ...(query.maxDays ? { lte: query.maxDays } : {}),
            },
          }
        : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            basePriceCents: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice * 100 } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice * 100 } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { summary: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.package.findMany({
        where,
        select: PACKAGE_SUMMARY_SELECT,
        orderBy: this.packageOrderBy(query.sort),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.package.count({ where }),
    ]);

    return paginate(items, total, query.page, query.limit);
  }

  private packageOrderBy(sort: PackageSort): Prisma.PackageOrderByWithRelationInput[] {
    switch (sort) {
      case PackageSort.PriceAsc:
        return [{ basePriceCents: 'asc' }, { title: 'asc' }];
      case PackageSort.PriceDesc:
        return [{ basePriceCents: 'desc' }, { title: 'asc' }];
      case PackageSort.DurationAsc:
        return [{ durationDays: 'asc' }, { basePriceCents: 'asc' }];
      case PackageSort.Newest:
        return [{ createdAt: 'desc' }];
      case PackageSort.Featured:
      default:
        return [{ featured: 'desc' }, { title: 'asc' }];
    }
  }

  getPackageBySlug(slug: string): Promise<PackageDetail> {
    return this.cached(`${CACHE_PREFIX}:package:${slug}`, () => this.queryPackageBySlug(slug));
  }

  private async queryPackageBySlug(slug: string): Promise<PackageDetail> {
    const record = await this.prisma.package.findUnique({
      where: { slug },
      select: PACKAGE_DETAIL_SELECT,
    });

    if (!record) {
      throw new NotFoundException(`No package exists with slug "${slug}".`);
    }

    const resolved = await this.refs.resolve(
      record.days.flatMap((day) => day.items.map((item) => ({ type: item.type, refId: item.refId }))),
    );

    return {
      ...record,
      days: record.days.map((day) => ({
        id: day.id,
        dayNumber: day.dayNumber,
        title: day.title,
        summary: day.summary,
        items: day.items.map((item): ResolvedDayItem => {
          const reference: ResolvedDayItem['reference'] = item.refId
            ? item.type === ItemType.PLACE && resolved.places.has(item.refId)
              ? { kind: 'PLACE', place: resolved.places.get(item.refId)! }
              : item.type === ItemType.HOTEL && resolved.hotels.has(item.refId)
                ? { kind: 'HOTEL', hotel: resolved.hotels.get(item.refId)! }
                : item.type === ItemType.TRANSPORT && resolved.transports.has(item.refId)
                  ? { kind: 'TRANSPORT', transport: resolved.transports.get(item.refId)! }
                  : item.type === ItemType.GUIDE && resolved.guides.has(item.refId)
                    ? { kind: 'GUIDE', guide: resolved.guides.get(item.refId)! }
                    : null
            : null;

          return { ...item, reference };
        }),
      })),
    };
  }

  // --------------------------------------------------------------- places

  listPlaces(query: ListPlacesQueryDto): Promise<Paginated<PlaceSummary>> {
    return this.cached(this.keyFor('places', query), async () => {
      const where: Prisma.PlaceWhereInput = {
        ...(query.city ? { city: { slug: query.city } } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { description: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        this.prisma.place.findMany({
          where,
          select: PLACE_SUMMARY_SELECT,
          orderBy: [{ name: 'asc' }],
          skip: query.skip,
          take: query.limit,
        }),
        this.prisma.place.count({ where }),
      ]);

      return paginate(items, total, query.page, query.limit);
    });
  }

  getPlaceBySlug(slug: string): Promise<PlaceDetail> {
    return this.cached(`${CACHE_PREFIX}:place:${slug}`, async () => {
      const record = await this.prisma.place.findUnique({
        where: { slug },
        select: PLACE_DETAIL_SELECT,
      });
      if (!record) {
        throw new NotFoundException(`No place exists with slug "${slug}".`);
      }
      return record;
    });
  }

  // --------------------------------------------------------------- hotels

  listHotels(query: ListHotelsQueryDto): Promise<Paginated<HotelRecord>> {
    return this.cached(this.keyFor('hotels', query), async () => {
      const where: Prisma.HotelWhereInput = {
        ...(query.city ? { city: { slug: query.city } } : {}),
        ...(query.maxPrice !== undefined ? { pricePerNightCents: { lte: query.maxPrice * 100 } } : {}),
        ...(query.minStars !== undefined ? { starRating: { gte: query.minStars } } : {}),
        ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
      };

      const [items, total] = await Promise.all([
        this.prisma.hotel.findMany({
          where,
          select: HOTEL_SELECT,
          orderBy: [{ pricePerNightCents: 'asc' }],
          skip: query.skip,
          take: query.limit,
        }),
        this.prisma.hotel.count({ where }),
      ]);

      return paginate(items, total, query.page, query.limit);
    });
  }

  getHotelBySlug(slug: string): Promise<HotelRecord> {
    return this.cached(`${CACHE_PREFIX}:hotel:${slug}`, async () => {
      const record = await this.prisma.hotel.findUnique({ where: { slug }, select: HOTEL_SELECT });
      if (!record) {
        throw new NotFoundException(`No hotel exists with slug "${slug}".`);
      }
      return record;
    });
  }

  // ------------------------------------------------------------ transport

  listTransports(query: ListTransportsQueryDto): Promise<Paginated<TransportRecord>> {
    return this.cached(this.keyFor('transports', query), async () => {
      const where: Prisma.TransportWhereInput = {
        ...(query.from ? { originCity: { slug: query.from } } : {}),
        ...(query.to ? { destinationCity: { slug: query.to } } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.maxPrice !== undefined
          ? { pricePerSeatCents: { lte: query.maxPrice * 100 } }
          : {}),
      };

      const [items, total] = await Promise.all([
        this.prisma.transport.findMany({
          where,
          select: TRANSPORT_SELECT,
          orderBy: [{ departureTime: 'asc' }],
          skip: query.skip,
          take: query.limit,
        }),
        this.prisma.transport.count({ where }),
      ]);

      return paginate(items, total, query.page, query.limit);
    });
  }

  getTransportBySlug(slug: string): Promise<TransportRecord> {
    return this.cached(`${CACHE_PREFIX}:transport:${slug}`, async () => {
      const record = await this.prisma.transport.findUnique({
        where: { slug },
        select: TRANSPORT_SELECT,
      });
      if (!record) {
        throw new NotFoundException(`No transport route exists with slug "${slug}".`);
      }
      return record;
    });
  }

  // --------------------------------------------------------------- guides

  listGuides(query: ListGuidesQueryDto): Promise<Paginated<GuideRecord>> {
    return this.cached(this.keyFor('guides', query), async () => {
      const where: Prisma.GuideWhereInput = {
        ...(query.city ? { city: { slug: query.city } } : {}),
        ...(query.language ? { languages: { has: query.language } } : {}),
        ...(query.maxPrice !== undefined ? { pricePerDayCents: { lte: query.maxPrice * 100 } } : {}),
      };

      const [items, total] = await Promise.all([
        this.prisma.guide.findMany({
          where,
          select: GUIDE_SELECT,
          orderBy: [{ rating: 'desc' }],
          skip: query.skip,
          take: query.limit,
        }),
        this.prisma.guide.count({ where }),
      ]);

      return paginate(items, total, query.page, query.limit);
    });
  }

  getGuideBySlug(slug: string): Promise<GuideRecord> {
    return this.cached(`${CACHE_PREFIX}:guide:${slug}`, async () => {
      const record = await this.prisma.guide.findUnique({ where: { slug }, select: GUIDE_SELECT });
      if (!record) {
        throw new NotFoundException(`No guide exists with slug "${slug}".`);
      }
      return record;
    });
  }

  // --------------------------------------------------------------- cities

  listCities(): Promise<CityRecord[]> {
    return this.cached(`${CACHE_PREFIX}:cities`, () =>
      this.prisma.city.findMany({ select: CITY_SELECT, orderBy: { name: 'asc' } }),
    );
  }

  /** Invalidates every cached catalogue read; called after any catalogue write. */
  async invalidate(): Promise<void> {
    const removed = await this.redis.delByPattern(`${CACHE_PREFIX}:*`);
    this.logger.log(`Invalidated ${removed} catalogue cache entries`);
  }

  /**
   * Cache-aside wrapper. Redis being unavailable degrades to a direct database
   * read rather than failing the request.
   */
  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    try {
      return await this.redis.remember(key, CACHE_TTL_SECONDS, factory);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.warn(`Cache unavailable for ${key}; reading through to Postgres`, {
        error: (error as Error).message,
      });
      return factory();
    }
  }

  /** Deterministic cache key from the query DTO's own field values. */
  private keyFor(resource: string, query: object): string {
    const entries = Object.entries(query)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${String(value)}`)
      .join('&');
    return `${CACHE_PREFIX}:${resource}:${entries}`;
  }
}
