import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { tripDetailKey } from '../../../common/cache/cache-keys';
import { ErrorCode } from '../../../common/errors/error-codes';
import { mapTripDetail } from '../utils';
import type { TripDetail } from '../interfaces';
import type { Lang } from '../../../common/i18n';
import { Prisma } from '@prisma/client';

@Injectable()
export class GetTripDetailUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(id: string, lang: Lang): Promise<TripDetail> {
    return this.cache.getOrSet(tripDetailKey(id, lang), 600, async () => {
      const row = await this.prisma.trip.findFirst({
        where: { id, isPublished: true },
        select: {
          id: true,
          category: true,
          durationDays: true,
          basePriceUsd: true,
          maxCapacity: true,
          coverImage: true,
          images: true,
          translations: {
            select: {
              language: true,
              title: true,
              subtitle: true,
              description: true,
              includedItems: true,
              excludedItems: true,
              cancellationPolicy: true,
              meetingPoint: true,
            },
          },
          itineraryItems: {
            select: {
              id: true,
              dayNumber: true,
              sortOrder: true,
              translations: {
                select: { language: true, title: true, description: true },
              },
            },
            orderBy: [
              { dayNumber: Prisma.SortOrder.asc },
              { sortOrder: Prisma.SortOrder.asc },
            ],
          },
        },
      });

      if (!row) {
        throw new NotFoundException({
          code: ErrorCode.TRP_NOT_FOUND,
          message: 'Trip not found',
        });
      }

      return mapTripDetail(row, lang);
    });
  }
}
