import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { placeRelatedKey } from '../../../common/cache/cache-keys';
import { mapPlaceSummary } from '../utils';
import type { PlaceSummary } from '../interfaces';
import type { Lang } from '../../../common/i18n';

@Injectable()
export class GetRelatedPlacesUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(id: string, lang: Lang): Promise<PlaceSummary[]> {
    return this.cache.getOrSet(placeRelatedKey(id, lang), 600, async () => {
      const source = await this.prisma.place.findFirst({
        where: { id },
        select: { category: true },
      });

      if (!source) return [];

      const rows = await this.prisma.place.findMany({
        where: {
          id: { not: id },
          category: source.category,
          isPublished: true,
        },
        select: {
          id: true,
          category: true,
          latitude: true,
          longitude: true,
          entryFeeUsd: true,
          images: true,
          translations: {
            where: { language: lang },
            select: { language: true, name: true },
          },
        },
        take: 6,
        orderBy: { createdAt: 'desc' },
      });

      return rows.map((r) => mapPlaceSummary(r, lang));
    });
  }
}
