import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { nearbyPlacesKey } from '../../../common/cache/cache-keys';
import { ErrorCode } from '../../../common/errors/error-codes';
import { haversine, mapPlaceSummary } from '../utils';
import type { PlaceSummary } from '../interfaces';
import type { Lang } from '../../../common/i18n';

@Injectable()
export class GetNearbyPlacesUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(
    id: string,
    radiusKm: number,
    lang: Lang,
  ): Promise<PlaceSummary[]> {
    return this.cache.getOrSet(
      nearbyPlacesKey(id, radiusKm, lang),
      300,
      async () => {
        const source = await this.prisma.place.findFirst({
          where: { id, isPublished: true },
          select: { latitude: true, longitude: true },
        });

        if (!source) {
          throw new NotFoundException({
            code: ErrorCode.PLC_NOT_FOUND,
            message: 'Place not found',
          });
        }

        const lat = Number(source.latitude);
        const lon = Number(source.longitude);

        const allPlaces = await this.prisma.place.findMany({
          where: { id: { not: id }, isPublished: true },
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
        });

        return allPlaces
          .filter(
            (p) =>
              haversine(lat, lon, Number(p.latitude), Number(p.longitude)) <=
              radiusKm,
          )
          .slice(0, 10)
          .map((r) => mapPlaceSummary(r, lang));
      },
    );
  }
}
