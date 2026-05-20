import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { guideDetailKey } from '../../../common/cache/cache-keys';
import { ErrorCode } from '../../../common/errors/error-codes';
import { mapGuideDetail } from '../utils';
import type { GuideDetail } from '../interfaces';
import type { Lang } from '../../../common/i18n';
import { Prisma } from '@prisma/client';

const GUIDE_DETAIL_SELECT = {
  id: true,
  bio: true,
  avatarUrl: true,
  images: true,
  pricePerDayUsd: true,
  province: true,
  provinces: true,
  isVerified: true,
  languages: { select: { language: true } },
  specialities: { select: { speciality: true } },
} satisfies Prisma.GuideSelect;

@Injectable()
export class GetGuideDetailUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(id: string, lang: Lang): Promise<GuideDetail> {
    const row = await this.prisma.guide.findFirst({
      where: { id, isActive: true },
      select: GUIDE_DETAIL_SELECT,
    });

    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.GUI_NOT_FOUND,
        message: 'Guide not found',
      });
    }

    return this.cache.getOrSet(guideDetailKey(id, lang), 600, () =>
      Promise.resolve(mapGuideDetail(row)),
    );
  }
}
