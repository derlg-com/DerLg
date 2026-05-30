import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ReleaseHoldUtil, computeRefund, assertTransition } from '../utils';
import type { CancelBookingDto } from '../dto';
import type { RefundResult, BookingCancelledEvent } from '../interfaces';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

/**
 * POST /v1/bookings/:id/cancel — compute refund tier, transition status
 * to `cancelled`, release the Redis hold key, emit booking.cancelled.
 *
 * The actual Stripe refund processor call lands in Phase 6 and consumes
 * the booking.cancelled event payload.
 */
@Injectable()
export class CancelBookingUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly releaseHold: ReleaseHoldUtil,
    private readonly events: EventEmitter2,
  ) {}

  async execute(
    user: JwtPayload,
    id: string,
    dto: CancelBookingDto,
  ): Promise<RefundResult> {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
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
    if (booking.status === BookingStatus.cancelled) {
      throw new BadRequestException({
        code: ErrorCode.BKNG_ALREADY_CANCELLED,
        message: 'Booking is already cancelled',
      });
    }

    // Block cancel during in-flight payment processing
    const processing = await this.prisma.payment.findFirst({
      where: { bookingId: id, status: 'processing' },
    });
    if (processing) {
      throw new ConflictException({
        code: ErrorCode.BKNG_PAYMENT_PENDING,
        message: 'Cannot cancel while payment is still processing',
      });
    }

    assertTransition(booking.status, BookingStatus.cancelled);

    const refund = computeRefund(
      { startDate: booking.startDate, totalUsd: booking.totalUsd },
      new Date(),
    );

    await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.cancelled,
        cancelledAt: new Date(),
        cancelReason: dto.reason ?? null,
        refundPercentage: refund.percentage,
      },
    });

    await this.releaseHold.release(id);

    const event: BookingCancelledEvent = {
      bookingId: id,
      userId: booking.userId,
      reference: booking.reference,
      refundAmountUsd: refund.amountUsd,
      refundPercentage: refund.percentage,
      cancelledAt: new Date().toISOString(),
    };
    this.events.emit('booking.cancelled', event);

    return {
      refundAmountUsd: refund.amountUsd,
      refundPercentage: refund.percentage,
      refundMethod: null, // Phase 6 owns Stripe refund processor
    };
  }
}
