import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CommitBookingUseCase } from '../../bookings/use-cases/commit-booking.use-case';
import { generateReference } from '../../bookings/utils/generate-reference.util';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';
import type { BookingDetail } from '../../bookings/interfaces';
import type { BookGuideDto } from '../dto/book-guide.dto';

@Injectable()
export class BookGuideUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commitBooking: CommitBookingUseCase,
  ) {}

  async execute(
    user: JwtPayload,
    guideId: string,
    dto: BookGuideDto,
    idempotencyKey?: string,
  ): Promise<BookingDetail> {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) {
      throw new BadRequestException({
        code: ErrorCode.BKNG_INVALID_DATE_RANGE,
      });
    }

    const guide = await this.prisma.guide.findFirst({
      where: { id: guideId },
      include: {
        languages: true,
        specialties: true,
      },
    });
    if (!guide) {
      throw new NotFoundException({ code: ErrorCode.GDE_NOT_FOUND });
    }
    if (!guide.isActive) {
      throw new ForbiddenException({ code: ErrorCode.GDE_INACTIVE });
    }

    if (dto.linkedTripBookingId) {
      await this.validateLinkedTrip(user, dto.linkedTripBookingId, dto);
    }

    // Guide has no name column (and no Prisma relation to User); resolve the
    // display name from the linked user for the booking snapshot.
    const guideUser = await this.prisma.user.findUnique({
      where: { id: guide.userId },
      select: { fullName: true },
    });

    const days = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / 86_400_000),
    );
    const subtotal = guide.pricePerDayUsd.times(days);

    return this.commitBooking.execute(
      user,
      {
        reference: generateReference('GDE'),
        totalPriceUsd: subtotal,
        items: [
          {
            type: 'tour_guide',
            resourceId: guide.id,
            startDate: start,
            endDate: end,
            quantity: days,
            unitPriceUsd: guide.pricePerDayUsd,
            subtotalUsd: subtotal,
            snapshot: {
              guideId: guide.id,
              name: guideUser?.fullName ?? 'Tour Guide',
              coverImageUrl: guide.avatarUrl ?? null,
              languages: guide.languages.map((l) => l.language),
              specialties: guide.specialties.map((s) => s.specialty),
              province: guide.province,
              isVerified: guide.isVerified,
              pricePerDayUsd: guide.pricePerDayUsd.toNumber(),
              days,
              linkedTripBookingId: dto.linkedTripBookingId ?? null,
              specialRequests: dto.specialRequests ?? null,
            },
          },
        ],
        metadata: {
          method: 'single_resource',
          singleResourceKind: 'guide',
        },
      },
      idempotencyKey,
    );
  }

  private async validateLinkedTrip(
    user: JwtPayload,
    linkedTripBookingId: string,
    dto: BookGuideDto,
  ): Promise<void> {
    const linked = await this.prisma.booking.findFirst({
      where: {
        id: linkedTripBookingId,
        userId: user.sub,
        deletedAt: null,
        status: { in: ['hold', 'pending_payment', 'confirmed'] },
      },
      include: { items: { orderBy: { startDate: 'asc' } } },
    });
    if (!linked) {
      throw new BadRequestException({
        code: ErrorCode.GDE_INVALID_TRIP_LINK,
        message: 'Linked trip booking not found or not owned by user',
      });
    }
    const isTripBooking =
      linked.singleResourceKind === 'trip' ||
      ['public_package', 'custom_itinerary'].includes(linked.method);
    if (!isTripBooking) {
      throw new BadRequestException({
        code: ErrorCode.GDE_INVALID_TRIP_LINK,
        message: 'Linked booking is not a trip booking',
      });
    }
    const linkedStart = linked.items[0]?.startDate;
    const linkedEnd = linked.items[linked.items.length - 1]?.endDate;
    if (
      !linkedStart ||
      !linkedEnd ||
      new Date(dto.startDate) < linkedStart ||
      new Date(dto.endDate) > linkedEnd
    ) {
      throw new BadRequestException({
        code: ErrorCode.GDE_INVALID_TRIP_LINK,
        message: 'Guide dates must fall within linked trip dates',
      });
    }
  }
}
