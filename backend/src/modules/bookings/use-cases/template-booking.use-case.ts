import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, BookingMethod } from '@prisma/client';
import { CommitBookingUseCase } from './commit-booking.use-case';
import { generateReference } from '../utils/generate-reference.util';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { CreateTemplateBookingDto } from '../dto/create-template-booking.dto';
import type {
  CommitInput,
  CommitInputItem,
  BookingDetail,
} from '../interfaces';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

/**
 * Template path entry point — covers M1 / M2 / M3.
 *
 * Takes a multi-resource journey body (items[] with optional tripTemplateId
 * link), assembles a CommitInput, and delegates to CommitBookingUseCase.
 *
 * This is the minimal proof of the template path. The richer M3 flow
 * (skeleton generator, per-day wizard, JourneyConfiguration model, drafts),
 * M2's template loading + edit detection, and M1's atomic capacity tracking
 * each ship in their own follow-up PR on top of this primitive.
 */
@Injectable()
export class TemplateBookingUseCase {
  constructor(private readonly commitBooking: CommitBookingUseCase) {}

  async execute(
    user: JwtPayload,
    dto: CreateTemplateBookingDto,
    idempotencyKey?: string,
  ): Promise<BookingDetail> {
    if (dto.items.length === 0) {
      throw new BadRequestException({
        code: ErrorCode.BKNG_INVALID_DATE_RANGE,
        message: 'A template booking must contain at least one item',
      });
    }

    const items: CommitInputItem[] = dto.items.map((item) => {
      const unitPrice = new Prisma.Decimal(item.unitPriceUsd);
      const subtotal = unitPrice.mul(item.quantity);
      return {
        type: item.type,
        resourceId: item.resourceId,
        startDate: new Date(item.startDate),
        endDate: new Date(item.endDate),
        quantity: item.quantity,
        unitPriceUsd: unitPrice,
        subtotalUsd: subtotal,
        snapshot: {
          resourceId: item.resourceId,
          type: item.type,
          startDate: item.startDate,
          endDate: item.endDate,
        },
      };
    });

    const totalPriceUsd = items.reduce(
      (acc, i) => acc.add(i.subtotalUsd),
      new Prisma.Decimal(0),
    );

    const input: CommitInput = {
      reference: generateReference('CSM'),
      totalPriceUsd,
      items,
      metadata: {
        method: BookingMethod.custom_itinerary,
        tripTemplateId: dto.tripTemplateId,
      },
    };

    return this.commitBooking.execute(user, input, idempotencyKey);
  }
}
