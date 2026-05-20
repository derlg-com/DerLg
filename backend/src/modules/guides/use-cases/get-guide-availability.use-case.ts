import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { guideAvailabilityKey } from '../../../common/cache/cache-keys';
import { ErrorCode } from '../../../common/errors/error-codes';
import { buildBusyRanges } from '../utils';
import type { AvailabilityQueryDto } from '../dto';
import type { GuideAvailability } from '../interfaces';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class GetGuideAvailabilityUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(
    guideId: string,
    query: AvailabilityQueryDto,
  ): Promise<GuideAvailability> {
    const { from, to } = query;

    const guide = await this.prisma.guide.findFirst({
      where: { id: guideId, isActive: true },
      select: { id: true },
    });

    if (!guide) {
      throw new NotFoundException({
        code: ErrorCode.GUI_NOT_FOUND,
        message: 'Guide not found',
      });
    }

    return this.cache.getOrSet(
      guideAvailabilityKey(guideId, from, to),
      300,
      async () => {
        const fromDate = new Date(from);
        const toDate = new Date(to);

        const bookingItems = await this.prisma.bookingItem.findMany({
          where: {
            guideId,
            date: { gte: fromDate, lt: toDate },
            booking: {
              status: { in: [BookingStatus.reserved, BookingStatus.confirmed] },
            },
          },
          select: { date: true },
        });

        return {
          guideId,
          busyRanges: buildBusyRanges(bookingItems, fromDate, toDate),
        };
      },
    );
  }
}
