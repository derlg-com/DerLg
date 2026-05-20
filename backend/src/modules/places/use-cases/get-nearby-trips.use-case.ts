import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { nearbyTripsKey } from '../../../common/cache/cache-keys';
import { ErrorCode } from '../../../common/errors/error-codes';
import { haversine } from '../utils';
import { mapTripSummary } from '../../trips/utils';
import type { TripSummary } from '../../trips/interfaces';
import type { Lang } from '../../../common/i18n';

@Injectable()
export class GetNearbyTripsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(
    id: string,
    radiusKm: number,
    lang: Lang,
  ): Promise<TripSummary[]> {
    return this.cache.getOrSet(
      nearbyTripsKey(id, radiusKm, lang),
      300,
      async () => {
        const place = await this.prisma.place.findFirst({
          where: { id, isPublished: true },
          select: { latitude: true, longitude: true },
        });

        if (!place) {
          throw new NotFoundException({
            code: ErrorCode.PLC_NOT_FOUND,
            message: 'Place not found',
          });
        }

        const lat = Number(place.latitude);
        const lon = Number(place.longitude);

        // Find places within radius, then find trips linked to those places
        const nearbyPlaces = await this.prisma.place.findMany({
          where: { isPublished: true },
          select: { id: true, latitude: true, longitude: true },
        });

        const nearbyPlaceIds = nearbyPlaces
          .filter(
            (p) =>
              haversine(lat, lon, Number(p.latitude), Number(p.longitude)) <=
              radiusKm,
          )
          .map((p) => p.id);

        if (nearbyPlaceIds.length === 0) return [];

        const trips = await this.prisma.trip.findMany({
          where: {
            isPublished: true,
            itineraryItems: { some: { placeId: { in: nearbyPlaceIds } } },
          },
          select: {
            id: true,
            category: true,
            durationDays: true,
            basePriceUsd: true,
            coverImage: true,
            images: true,
            maxCapacity: true,
            translations: {
              where: { language: lang },
              select: { language: true, title: true, subtitle: true },
            },
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
        });

        return trips.map((r) => mapTripSummary(r, lang));
      },
    );
  }
}
