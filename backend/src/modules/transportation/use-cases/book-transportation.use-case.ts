import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CommitBookingUseCase } from '../../bookings/use-cases/commit-booking.use-case';
import { generateReference } from '../../bookings/utils/generate-reference.util';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';
import type { BookingDetail } from '../../bookings/interfaces';
import type { BookTransportationDto } from '../dto/book-transportation.dto';

@Injectable()
export class BookTransportationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commitBooking: CommitBookingUseCase,
  ) {}

  async execute(
    user: JwtPayload,
    dto: BookTransportationDto,
    idempotencyKey?: string,
  ): Promise<BookingDetail> {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) {
      throw new BadRequestException({
        code: ErrorCode.BKNG_INVALID_DATE_RANGE,
      });
    }

    const vehicle = await this.prisma.transportationVehicle.findFirst({
      where: { id: dto.vehicleId, isActive: true },
    });
    if (!vehicle) {
      throw new NotFoundException({ code: ErrorCode.TRNS_NOT_FOUND });
    }

    const days = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / 86_400_000),
    );

    let quantity: number;
    let subtotal: Prisma.Decimal;

    if (vehicle.pricingModel === 'per_day') {
      quantity = days;
      subtotal = vehicle.priceUsd.times(days);
    } else if (vehicle.pricingModel === 'per_km') {
      if (dto.estimatedDistanceKm == null) {
        throw new BadRequestException({
          code: ErrorCode.TRNS_PRICING_REQUIRES_DISTANCE,
        });
      }
      quantity = dto.estimatedDistanceKm;
      subtotal = vehicle.priceUsd.times(dto.estimatedDistanceKm);
    } else {
      throw new InternalServerErrorException({
        code: ErrorCode.TRNS_PRICING_MISCONFIGURED,
      });
    }

    return this.commitBooking.execute(
      user,
      {
        reference: generateReference('TRN'),
        totalPriceUsd: subtotal,
        items: [
          {
            type: 'transportation',
            resourceId: vehicle.id,
            startDate: start,
            endDate: end,
            quantity,
            unitPriceUsd: vehicle.priceUsd,
            subtotalUsd: subtotal,
            snapshot: {
              vehicleId: vehicle.id,
              label: vehicle.name,
              type: vehicle.vehicleType,
              capacity: vehicle.capacity,
              pricingModel: vehicle.pricingModel,
              pickupLocation: dto.pickupLocation,
              dropoffLocation: dto.dropoffLocation,
              stops: dto.stops ?? [],
              estimatedDistanceKm: dto.estimatedDistanceKm ?? null,
            },
          },
        ],
        metadata: {
          method: 'single_resource',
          singleResourceKind: 'transportation',
        },
      },
      idempotencyKey,
    );
  }
}
