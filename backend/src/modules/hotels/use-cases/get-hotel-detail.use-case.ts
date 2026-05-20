import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { hotelDetailKey } from '../../../common/cache/cache-keys';
import { ErrorCode } from '../../../common/errors/error-codes';
import { mapHotelDetail } from '../utils';
import type { HotelDetail } from '../interfaces';
import type { Lang } from '../../../common/i18n';
import { Prisma } from '@prisma/client';

@Injectable()
export class GetHotelDetailUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(id: string, lang: Lang): Promise<HotelDetail> {
    return this.cache.getOrSet(hotelDetailKey(id, lang), 600, async () => {
      const row = await this.prisma.hotel.findFirst({
        where: { id, isPublished: true },
        select: {
          id: true,
          starRating: true,
          images: true,
          amenities: true,
          latitude: true,
          longitude: true,
          translations: {
            select: {
              language: true,
              name: true,
              address: true,
              description: true,
            } satisfies Prisma.HotelTranslationSelect,
          },
        },
      });

      if (!row) {
        throw new NotFoundException({
          code: ErrorCode.HTL_NOT_FOUND,
          message: 'Hotel not found',
        });
      }

      return mapHotelDetail(row, lang);
    });
  }
}
