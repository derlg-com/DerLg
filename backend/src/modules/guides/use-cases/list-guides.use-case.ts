import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { guideListKey } from '../../../common/cache/cache-keys';
import { mapGuideSummary } from '../utils';
import type { ListGuidesDto } from '../dto';
import type { GuideSummary } from '../interfaces';
import type { Lang } from '../../../common/i18n';
import type { PaginatedResponse } from '../../../common/types/paginated-response.type';
import { Prisma } from '@prisma/client';

const GUIDE_SELECT = {
  id: true,
  avatarUrl: true,
  images: true,
  bio: true,
  pricePerDayUsd: true,
  province: true,
  provinces: true,
  isVerified: true,
  languages: { select: { language: true } },
  specialities: { select: { speciality: true } },
} satisfies Prisma.GuideSelect;

@Injectable()
export class ListGuidesUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(
    query: ListGuidesDto,
    lang: Lang,
  ): Promise<PaginatedResponse<GuideSummary>> {
    const { page = 1, limit = 20, language, speciality } = query;
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    const cacheKey = guideListKey(
      { page: safePage, limit: safeLimit, language, speciality },
      lang,
    );

    return this.cache.getOrSet(cacheKey, 300, async () => {
      const where: Prisma.GuideWhereInput = {
        isActive: true,
        ...(language && {
          languages: { some: { language } },
        }),
        ...(speciality && {
          specialities: { some: { speciality } },
        }),
      };

      const [total, rows] = await Promise.all([
        this.prisma.guide.count({ where }),
        this.prisma.guide.findMany({
          where,
          select: GUIDE_SELECT,
          skip: (safePage - 1) * safeLimit,
          take: safeLimit,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return {
        items: rows.map(mapGuideSummary),
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      };
    });
  }
}
