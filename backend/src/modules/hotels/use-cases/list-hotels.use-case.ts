import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { hotelListKey } from '../../../common/cache/cache-keys';
import { mapHotelSummary } from '../utils';
import type { ListHotelsDto } from '../dto';
import type { HotelSummary } from '../interfaces';
import type { Lang } from '../../../common/i18n';
import type { PaginatedResponse } from '../../../common/types/paginated-response.type';
import { Prisma } from '@prisma/client';

const HOTEL_SUMMARY_SELECT = {
  id: true,
  starRating: true,
  images: true,
  latitude: true,
  longitude: true,
} satisfies Prisma.HotelSelect;

const TRANSLATION_SELECT = {
  language: true,
  name: true,
  address: true,
} satisfies Prisma.HotelTranslationSelect;

@Injectable()
export class ListHotelsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(
    query: ListHotelsDto,
    lang: Lang,
  ): Promise<PaginatedResponse<HotelSummary>> {
    const { page = 1, limit = 20, starRating } = query;
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    const cacheKey = hotelListKey(
      { page: safePage, limit: safeLimit, starRating },
      lang,
    );

    return this.cache.getOrSet(cacheKey, 300, async () => {
      const where: Prisma.HotelWhereInput = {
        isPublished: true,
        ...(starRating !== undefined && { starRating }),
      };

      const [total, rows] = await Promise.all([
        this.prisma.hotel.count({ where }),
        this.prisma.hotel.findMany({
          where,
          select: {
            ...HOTEL_SUMMARY_SELECT,
            translations: {
              where: { language: lang },
              select: TRANSLATION_SELECT,
            },
          },
          skip: (safePage - 1) * safeLimit,
          take: safeLimit,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      // Fallback to EN for rows missing the requested lang
      const needsFallback = rows.filter((r) => r.translations.length === 0);
      if (needsFallback.length > 0 && lang !== 'en') {
        const fallbackRows = await this.prisma.hotel.findMany({
          where: { id: { in: needsFallback.map((r) => r.id) } },
          select: {
            id: true,
            translations: {
              where: { language: 'en' },
              select: TRANSLATION_SELECT,
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
        items: rows.map((r) => mapHotelSummary(r, lang)),
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      };
    });
  }
}
