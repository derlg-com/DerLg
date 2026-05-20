import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { placeListKey } from '../../../common/cache/cache-keys';
import { mapPlaceSummary } from '../utils';
import type { ListPlacesDto } from '../dto';
import type { PlaceSummary } from '../interfaces';
import type { Lang } from '../../../common/i18n';
import type { PaginatedResponse } from '../../../common/types/paginated-response.type';
import { Prisma } from '@prisma/client';

@Injectable()
export class ListPlacesUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(
    query: ListPlacesDto,
    lang: Lang,
  ): Promise<PaginatedResponse<PlaceSummary>> {
    const { page = 1, limit = 20, category } = query;
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    const cacheKey = placeListKey(
      { page: safePage, limit: safeLimit, category },
      lang,
    );

    return this.cache.getOrSet(cacheKey, 300, async () => {
      const where: Prisma.PlaceWhereInput = {
        isPublished: true,
        ...(category && { category }),
      };

      const translationSelect = {
              language: true,
              name: true,
            } satisfies Prisma.PlaceTranslationSelect;
      
            const [total, rows] = await Promise.all([
              this.prisma.place.count({ where }),
              this.prisma.place.findMany({
                where,
                select: {
                  id: true,
                  category: true,
                  latitude: true,
                  longitude: true,
                  entryFeeUsd: true,
                  images: true,
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
              const fallbackRows = await this.prisma.place.findMany({
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
              items: rows.map((r) => mapPlaceSummary(r, lang)),
              total,
              page: safePage,
              limit: safeLimit,
              totalPages: Math.ceil(total / safeLimit),
            };
    });
  }
}
