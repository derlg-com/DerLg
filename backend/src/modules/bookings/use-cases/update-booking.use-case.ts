import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { BookingStatus, BookingType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { checkOverlap, mapBookingDetail, CheckRoomAvailabilityUtil } from '../utils';
import type { UpdateBookingDto } from '../dto';
import type { BookingDetail } from '../interfaces';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

/**
 * PATCH /v1/bookings/:id — update a HOLD booking before payment.
 * Forbidden once the booking has progressed past HOLD. If startDate or
 * endDate changes, re-runs the availability check and recalculates pricing.
 */
@Injectable()
export class UpdateBookingUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkRoom: CheckRoomAvailabilityUtil,
  ) {}

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
          const todayUtc = new Date(new Date().toISOString().slice(0, 10));
          if (newStart < todayUtc) {
            throw new BadRequestException({
              code: ErrorCode.BKNG_INVALID_DATE_RANGE,
              message: 'startDate cannot be in the past',
            });
          }

          if (item.bookingType === BookingType.hotel_room && item.hotelRoomId) {
            const ok = await this.checkRoom.isAvailable(tx, {
              hotelRoomId: item.hotelRoomId,
              totalRooms: 1,
              checkInDate: newStart,
              checkOutDate: newEnd,
            });
            if (!ok) {
              throw new ConflictException({
                code: ErrorCode.BKNG_UNAVAILABLE,
                message: 'Room is fully booked for at least one requested night',
              });
            }
          } else if (item.bookingType === BookingType.trip_package && item.tripId) {
            const trip = await tx.trip.findUnique({
              where: { id: item.tripId },
              select: { maxCapacity: true },
            });
            const maxCap = trip?.maxCapacity ?? 10;
            const conflicts = await tx.bookingItem.findMany({
              where: {
                tripId: item.tripId,
                bookingType: item.bookingType,
                id: { not: item.id },
                booking: {
                  status: { in: ['hold', 'pending_payment', 'confirmed'] },
                  deletedAt: null,
                },
              },
              select: { startDate: true, endDate: true, quantity: true },
            });
            const overlapping = conflicts.filter((c) =>
              checkOverlap([c], { startDate: newStart, endDate: newEnd }),
            );
            const currentBooked = overlapping.reduce((sum, c) => sum + c.quantity, 0);
            if (currentBooked + item.quantity > maxCap) {
              throw new ConflictException({
                code: ErrorCode.BKNG_UNAVAILABLE,
                message: 'Trip capacity exceeded for the requested dates',
              });
            }
          } else {
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
          }

          let newQuantity = item.quantity;
          let newSubtotal = item.subtotalUsd;
          if (item.bookingType === BookingType.hotel_room) {
            const nights = Math.max(1, Math.round((newEnd.getTime() - newStart.getTime()) / 86_400_000));
            newQuantity = nights;
            newSubtotal = item.unitPriceUsd.mul(nights);
          } else if (item.bookingType === BookingType.tour_guide) {
            const days = Math.max(1, Math.ceil((newEnd.getTime() - newStart.getTime()) / 86_400_000));
            newQuantity = days;
            newSubtotal = item.unitPriceUsd.mul(days);
          } else if (item.bookingType === BookingType.transportation) {
            const snap = (item.snapshot && typeof item.snapshot === 'object' ? item.snapshot : {}) as Record<string, any>;
            if (snap.pricingModel !== 'per_km') {
              const days = Math.max(1, Math.ceil((newEnd.getTime() - newStart.getTime()) / 86_400_000));
              newQuantity = days;
              newSubtotal = item.unitPriceUsd.mul(days);
            }
          }

          await tx.bookingItem.update({
            where: { id: item.id },
            data: {
              startDate: newStart,
              endDate: newEnd,
              quantity: newQuantity,
              subtotalUsd: newSubtotal,
            },
          });
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              startDate: newStart,
              endDate: newEnd,
              subtotalUsd: newSubtotal,
              totalUsd: newSubtotal,
            },
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
