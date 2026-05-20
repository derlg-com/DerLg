import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { searchKey } from '../../../common/cache/cache-keys';
import { ErrorCode } from '../../../common/errors/error-codes';
import {
  mapTripHits,
  mapPlaceHits,
  mapHotelHits,
  mapGuideHits,
  mergeSearchResults,
} from '../utils';
import type { SearchQueryDto } from '../dto';
import { SearchType } from '../dto';
import type { SearchHit } from '../interfaces';
import type { Lang } from '../../../common/i18n';
import type { PaginatedResponse } from '../../../common/types/paginated-response.type';

@Injectable()
export class GlobalSearchUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(
    query: SearchQueryDto,
    lang: Lang,
  ): Promise<PaginatedResponse<SearchHit>> {
    const { q, type = SearchType.all, page = 1, limit = 20 } = query;
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    // Defence in depth — DTO already validates this
    if (q.length < 2) {
      throw new BadRequestException({
        code: ErrorCode.SRC_QUERY_TOO_SHORT,
        message: 'Query must be at least 2 characters',
      });
    }

    const cacheKeyStr = searchKey(q, type, safePage, safeLimit, lang);

    return this.cache.getOrSet(cacheKeyStr, 60, async () => {
      const searchTypes =
        type === SearchType.all
          ? [
              SearchType.trip,
              SearchType.place,
              SearchType.hotel,
              SearchType.guide,
            ]
          : [type];

      const perTypeLimit = Math.ceil(safeLimit / searchTypes.length);

      const tripWhere = searchTypes.includes(SearchType.trip)
        ? {
            isPublished: true as const,
            translations: {
              some: { title: { contains: q, mode: 'insensitive' as const } },
            },
          }
        : null;
      const placeWhere = searchTypes.includes(SearchType.place)
        ? {
            isPublished: true as const,
            translations: {
              some: { name: { contains: q, mode: 'insensitive' as const } },
            },
          }
        : null;
      const hotelWhere = searchTypes.includes(SearchType.hotel)
        ? {
            isPublished: true as const,
            translations: {
              some: { name: { contains: q, mode: 'insensitive' as const } },
            },
          }
        : null;
      const guideWhere = searchTypes.includes(SearchType.guide)
        ? {
            isActive: true as const,
            OR: [
              { bio: { contains: q, mode: 'insensitive' as const } },
              {
                specialities: {
                  some: {
                    speciality: { contains: q, mode: 'insensitive' as const },
                  },
                },
              },
            ],
          }
        : null;

      const [
        tripCount,
        placeCount,
        hotelCount,
        guideCount,
        trips,
        places,
        hotels,
        guides,
      ] = await Promise.all([
        tripWhere
          ? this.prisma.trip.count({ where: tripWhere })
          : Promise.resolve(0),
        placeWhere
          ? this.prisma.place.count({ where: placeWhere })
          : Promise.resolve(0),
        hotelWhere
          ? this.prisma.hotel.count({ where: hotelWhere })
          : Promise.resolve(0),
        guideWhere
          ? this.prisma.guide.count({ where: guideWhere })
          : Promise.resolve(0),
        tripWhere
          ? this.prisma.trip.findMany({
              where: tripWhere,
              select: {
                id: true,
                category: true,
                basePriceUsd: true,
                coverImage: true,
                translations: {
                  where: { language: lang },
                  select: { title: true },
                  take: 1,
                },
              },
              take: perTypeLimit,
            })
          : Promise.resolve([]),
        placeWhere
          ? this.prisma.place.findMany({
              where: placeWhere,
              select: {
                id: true,
                category: true,
                images: true,
                translations: {
                  where: { language: lang },
                  select: { name: true },
                  take: 1,
                },
              },
              take: perTypeLimit,
            })
          : Promise.resolve([]),
        hotelWhere
          ? this.prisma.hotel.findMany({
              where: hotelWhere,
              select: {
                id: true,
                starRating: true,
                images: true,
                translations: {
                  where: { language: lang },
                  select: { name: true },
                  take: 1,
                },
              },
              take: perTypeLimit,
            })
          : Promise.resolve([]),
        guideWhere
          ? this.prisma.guide.findMany({
              where: guideWhere,
              select: {
                id: true,
                avatarUrl: true,
                province: true,
                pricePerDayUsd: true,
              },
              take: perTypeLimit,
            })
          : Promise.resolve([]),
      ]);

      const total = tripCount + placeCount + hotelCount + guideCount;

      const items = mergeSearchResults(
        mapTripHits(trips),
        mapPlaceHits(places),
        mapHotelHits(hotels),
        mapGuideHits(guides),
      );

      return {
        items: items.slice(0, safeLimit),
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      };
    });
  }
}
