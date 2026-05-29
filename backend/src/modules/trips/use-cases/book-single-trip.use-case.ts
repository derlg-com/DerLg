import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CommitBookingUseCase } from '../../bookings/use-cases/commit-booking.use-case';
import { generateReference } from '../../bookings/utils/generate-reference.util';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';
import type { BookingDetail } from '../../bookings/interfaces';
import type { BookSingleTripDto } from '../dto/book-single-trip.dto';

@Injectable()
export class BookSingleTripUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commitBooking: CommitBookingUseCase,
  ) {}

  async execute(
    user: JwtPayload,
    tripId: string,
    dto: BookSingleTripDto,
    idempotencyKey?: string,
  ): Promise<BookingDetail> {
    const startDate = new Date(dto.startDate);
    const todayUtc = new Date(new Date().toISOString().slice(0, 10));
    if (startDate < todayUtc) {
      throw new BadRequestException({
        code: ErrorCode.BKNG_INVALID_DATE_RANGE,
      });
    }

    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, isPublished: true },
      include: {
        translations: { where: { language: 'en' }, take: 1 },
      },
    });
    if (!trip) {
      throw new NotFoundException({ code: ErrorCode.TRIP_NOT_FOUND });
    }

    const adults = dto.travelers.adults;
    const children = dto.travelers.children ?? 0;
    const total = adults + children;
    if (total > trip.maxCapacity) {
      throw new BadRequestException({
        code: ErrorCode.BKNG_EXCEEDS_GUESTS,
        message: `Trip allows up to ${trip.maxCapacity} travelers; got ${total}`,
      });
    }

    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + trip.durationDays - 1);

    const subtotal = trip.basePriceUsd.times(total);
    const translation = trip.translations[0];

    return this.commitBooking.execute(
      user,
      {
        reference: generateReference('TRP'),
        totalPriceUsd: subtotal,
        items: [
          {
            type: 'trip_package',
            resourceId: trip.id,
            startDate,
            endDate,
            quantity: total,
            unitPriceUsd: trip.basePriceUsd,
            subtotalUsd: subtotal,
            snapshot: {
              tripId: trip.id,
              category: trip.category,
              durationDays: trip.durationDays,
              travelersAdults: adults,
              travelersChildren: children,
              totalTravelers: total,
              pricePerPersonUsd: trip.basePriceUsd.toNumber(),
              name: translation?.title ?? tripId,
              meetingPoint: translation?.meetingPoint ?? null,
              cancellationPolicySnapshot:
                translation?.cancellationPolicy ?? null,
              includedItems: translation?.includedItems ?? [],
              excludedItems: translation?.excludedItems ?? [],
              coverImageUrl: trip.coverImage ?? null,
            },
          },
        ],
        metadata: {
          method: 'single_resource',
          singleResourceKind: 'trip',
        },
      },
      idempotencyKey,
    );
  }
}
