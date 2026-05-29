import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { checkOverlap, mapBookingDetail } from '../utils';
import type { UpdateBookingDto } from '../dto';
import type { BookingDetail } from '../interfaces';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

/**
 * PATCH /v1/bookings/:id — update a HOLD booking before payment.
 * Forbidden once the booking has progressed past HOLD. If startDate or
 * endDate changes, re-runs the overlap check on the (single) item.
 */
@Injectable()
export class UpdateBookingUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    user: JwtPayload,
    id: string,
    dto: UpdateBookingDto,
  ): Promise<BookingDetail> {
    if (Object.values(dto).every((v) => v === undefined)) {
      throw new BadRequestException({
        code: ErrorCode.BKNG_INVALID_DATE_RANGE,
        message: 'At least one field must be provided',
      });
    }

    return this.prisma.$transaction(
      async (tx: Prisma.TransactionClient): Promise<BookingDetail> => {
        const booking = await tx.booking.findFirst({
          where: { id, deletedAt: null },
          include: { items: true },
        });

        if (!booking) {
          throw new NotFoundException({
            code: ErrorCode.BKNG_NOT_FOUND,
            message: 'Not found',
          });
        }
        if (booking.userId !== user.sub) {
          throw new ForbiddenException({
            code: ErrorCode.BKNG_NOT_AUTHOR,
            message: 'Not your booking',
          });
        }
        if (booking.status !== BookingStatus.hold) {
          throw new ForbiddenException({
            code: ErrorCode.BKNG_CONFIRMED_CANNOT_MODIFY,
            message: 'Only HOLD bookings can be updated',
          });
        }

        if (dto.startDate || dto.endDate) {
          const item = booking.items[0];
          const newStart = dto.startDate
            ? new Date(dto.startDate)
            : item.startDate;
          const newEnd = dto.endDate ? new Date(dto.endDate) : item.endDate;
          if (newEnd < newStart) {
            throw new BadRequestException({
              code: ErrorCode.BKNG_INVALID_DATE_RANGE,
              message: 'endDate must be ≥ startDate',
            });
          }
          const conflicts = await tx.bookingItem.findMany({
            where: {
              bookingType: item.bookingType,
              tripId: item.tripId,
              hotelRoomId: item.hotelRoomId,
              vehicleId: item.vehicleId,
              guideId: item.guideId,
              id: { not: item.id },
              booking: {
                status: { in: ['hold', 'pending_payment', 'confirmed'] },
                deletedAt: null,
              },
            },
            select: { startDate: true, endDate: true },
          });
          if (
            checkOverlap(conflicts, { startDate: newStart, endDate: newEnd })
          ) {
            throw new ConflictException({
              code: ErrorCode.BKNG_UNAVAILABLE,
              message: 'Resource is unavailable for the requested dates',
            });
          }
          await tx.bookingItem.update({
            where: { id: item.id },
            data: { startDate: newStart, endDate: newEnd },
          });
          await tx.booking.update({
            where: { id: booking.id },
            data: { startDate: newStart, endDate: newEnd },
          });
        }

        const fresh = await tx.booking.findFirst({
          where: { id },
          include: { items: true },
        });
        return mapBookingDetail(fresh!);
      },
    );
  }
}
