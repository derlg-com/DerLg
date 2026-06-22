import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ReleaseHoldUtil, assertTransition, mapBookingDetail } from '../utils';
import { ConfirmBookingDto } from '../dto/confirm-booking.dto';
import type { BookingDetail } from '../interfaces';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

/**
 * POST /v1/bookings/:id/confirm — SANDBOX demo payment confirmation.
 *
 * Gated behind the `DEMO_PAYMENTS` env flag (OFF by default). Marks a booking
 * paid WITHOUT a real charge: transitions hold → confirmed, writes a
 * `succeeded` Payment row, sets a ticket QR, and releases the Redis hold so the
 * expiry job leaves it alone. Production payment confirmation must go through a
 * real provider (e.g. a verified Stripe webhook), never this endpoint.
 */
@Injectable()
export class ConfirmBookingUseCase {
  private static readonly CONFIRMABLE: BookingStatus[] = [
    BookingStatus.hold,
    BookingStatus.pending_payment,
    BookingStatus.payment_failed,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly releaseHold: ReleaseHoldUtil,
  ) {}

  async execute(
    user: JwtPayload,
    id: string,
    dto: ConfirmBookingDto,
  ): Promise<BookingDetail> {
    if (this.config.get<boolean>('DEMO_PAYMENTS') !== true) {
      throw new ForbiddenException({
        code: ErrorCode.PAY_METHOD_NOT_SUPPORTED,
        message: 'Demo payment confirmation is disabled',
      });
    }

    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });
    if (!booking) {
      throw new NotFoundException({
        code: ErrorCode.BKNG_NOT_FOUND,
        message: 'Booking not found',
      });
    }
    if (booking.userId !== user.sub) {
      throw new ForbiddenException({
        code: ErrorCode.BKNG_NOT_AUTHOR,
        message: 'Not your booking',
      });
    }

    // Idempotent: an already-confirmed/completed booking is returned as-is.
    if (
      booking.status === BookingStatus.confirmed ||
      booking.status === BookingStatus.completed
    ) {
      return mapBookingDetail(booking);
    }

    // Terminal states (cancelled / expired / no_show) throw the documented code.
    if (!ConfirmBookingUseCase.CONFIRMABLE.includes(booking.status)) {
      assertTransition(booking.status, BookingStatus.confirmed);
    }

    const provider = dto.method === 'card' ? 'stripe' : 'bakong';
    const ticketQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
      `DERLG-TICKET-${booking.reference}`,
    )}`;

    const updated = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            userId: booking.userId,
            provider,
            amountUsd: booking.totalUsd,
            currency: 'usd',
            status: 'succeeded',
            qrCodeUrl: provider === 'bakong' ? ticketQrUrl : null,
            paidAt: new Date(),
          },
        });
        return tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.confirmed, qrCodeUrl: ticketQrUrl },
          include: { items: true },
        });
      },
    );

    // Confirmed bookings no longer hold inventory via the TTL key.
    await this.releaseHold.release(booking.id);

    return mapBookingDetail(updated);
  }
}
