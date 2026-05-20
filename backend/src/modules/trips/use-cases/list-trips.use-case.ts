import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { tripListKey } from '../../../common/cache/cache-keys';
import { mapTripSummary } from '../utils';
import type { ListTripsDto } from '../dto';
import type { TripSummary } from '../interfaces';
import type { Lang } from '../../../common/i18n';
import type { PaginatedResponse } from '../../../common/types/paginated-response.type';
import { Prisma } from '@prisma/client';

const TRIP_SUMMARY_SELECT = {
  id: true,
  category: true,
  durationDays: true,
  basePriceUsd: true,
  coverImage: true,
  images: true,
  maxCapacity: true,
} satisfies Prisma.TripSelect;

@Injectable()
export class ListTripsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(
    query: ListTripsDto,
    lang: Lang,
  ): Promise<PaginatedResponse<TripSummary>> {
    const {
      page = 1,
      limit = 20,
      category,
      priceMin,
      priceMax,
      durationDays,
    } = query;
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    const cacheKey = tripListKey(
      {
        page: safePage,
        limit: safeLimit,
        category,
        priceMin,
        priceMax,
        durationDays,
      },
      lang,
    );

    return this.cache.getOrSet(cacheKey, 300, async () => {
      const priceFilter: Prisma.DecimalFilter = {};
      if (priceMin !== undefined) priceFilter.gte = priceMin;
      if (priceMax !== undefined) priceFilter.lte = priceMax;

      const where: Prisma.TripWhereInput = {
        isPublished: true,
        ...(category !== undefined && { category }),
        ...(Object.keys(priceFilter).length > 0 && {
          basePriceUsd: priceFilter,
        }),
        ...(durationDays !== undefined && { durationDays }),
      };

      const translationSelect = {
        language: true,
        title: true,
        subtitle: true,
        includedItems: true,
        excludedItems: true,
        cancellationPolicy: true,
        meetingPoint: true,
      } satisfies Prisma.TripTranslationSelect;

      const [total, rows] = await Promise.all([
        this.prisma.trip.count({ where }),
        this.prisma.trip.findMany({
          where,
          select: {
            ...TRIP_SUMMARY_SELECT,
            translations: {
              where: { language: lang },
              select: translationSelect,
            },
          },
          skip: (safePage - 1) * safeLimit,
          take: safeLimit,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      // Fallback: fetch EN translations for rows missing the requested lang
      const needsFallback = rows.filter((r) => r.translations.length === 0);
      if (needsFallback.length > 0 && lang !== 'en') {
        const fallbackRows = await this.prisma.trip.findMany({
          where: { id: { in: needsFallback.map((r) => r.id) } },
          select: {
            id: true,
            translations: {
              where: { language: 'en' },
              select: translationSelect,
            },
          },
        });
        const fallbackMap = new Map(
          fallbackRows.map((r) => [r.id, r.translations]),
        );
        for (const row of needsFallback) {
          row.translations = fallbackMap.get(row.id) ?? [];
        }
      }

      return {
        items: rows.map((r) => mapTripSummary(r, lang)),
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      };
    });
  }
}
