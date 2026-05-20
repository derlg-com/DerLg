import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { tripRelatedKey } from '../../../common/cache/cache-keys';
import { mapTripSummary } from '../utils';
import type { TripSummary } from '../interfaces';
import type { Lang } from '../../../common/i18n';

@Injectable()
export class GetRelatedTripsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(id: string, lang: Lang): Promise<TripSummary[]> {
    return this.cache.getOrSet(tripRelatedKey(id, lang), 600, async () => {
      const source = await this.prisma.trip.findFirst({
        where: { id },
        select: { category: true },
      });

      if (!source) return [];

      const rows = await this.prisma.trip.findMany({
        where: {
          id: { not: id },
          category: source.category,
          isPublished: true,
        },
        select: {
          id: true,
          category: true,
          durationDays: true,
          basePriceUsd: true,
          maxCapacity: true,
          coverImage: true,
          images: true,
          translations: {
            where: { language: lang },
            select: { language: true, title: true, subtitle: true },
          },
        },
        take: 6,
        orderBy: { createdAt: 'desc' },
      });

      return rows.map((r) => mapTripSummary(r, lang));
    });
  }
}
