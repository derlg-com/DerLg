import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { placeDetailKey } from '../../../common/cache/cache-keys';
import { ErrorCode } from '../../../common/errors/error-codes';
import { mapPlaceDetail } from '../utils';
import type { PlaceDetail } from '../interfaces';
import type { Lang } from '../../../common/i18n';

@Injectable()
export class GetPlaceDetailUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(id: string, lang: Lang): Promise<PlaceDetail> {
    return this.cache.getOrSet(placeDetailKey(id, lang), 600, async () => {
      const row = await this.prisma.place.findFirst({
        where: { id, isPublished: true },
        select: {
          id: true,
          category: true,
          latitude: true,
          longitude: true,
          entryFeeUsd: true,
          openingHours: true,
          dressCode: true,
          website: true,
          images: true,
          translations: {
            select: {
              language: true,
              name: true,
              description: true,
              visitorTips: true,
              address: true,
            },
          },
        },
      });

      if (!row) {
        throw new NotFoundException({
          code: ErrorCode.PLC_NOT_FOUND,
          message: 'Place not found',
        });
      }

      return mapPlaceDetail(row, lang);
    });
  }
}
