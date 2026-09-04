import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { PaymentsService } from './services/payments.service';

/** Payload emitted by `CancelBookingUseCase`. */
interface BookingCancelledEvent {
  bookingId: string;
  userId: string;
  reference: string;
  refundAmountUsd: number;
  refundPercentage: number;
  cancelledAt: string;
}

/**
 * Issues the refund for a cancelled booking.
 *
 * `CancelBookingUseCase` computes the refund tier, writes it to the booking and
 * emits `booking.cancelled` — but nothing consumed that event, so its own comment
 * read "the actual Stripe refund processor call lands in Phase 6". Until now a
 * customer cancelling inside the 100% window was told they would be refunded and
 * no money ever moved.
 *
 * Deliberately an event listener rather than an inline call in the use case:
 *
 *  - Cancellation must succeed even when the payment provider is down. Refunds are
 *    retryable and reconcilable; a failed cancellation leaves inventory held.
 *  - It keeps `BookingsModule` from importing `PaymentsModule`, which with the
 *    reverse dependency would be a circular module graph.
 */
@Injectable()
export class RefundOnCancelListener {
  private readonly logger = new Logger(RefundOnCancelListener.name);

  constructor(private readonly payments: PaymentsService) {}

  @OnEvent('booking.cancelled')
  async onBookingCancelled(event: BookingCancelledEvent): Promise<void> {
    if (event.refundAmountUsd <= 0) return; // 0% tier: under 24h to departure.

    try {
      await this.payments.refundForCancellation({
        bookingId: event.bookingId,
        amountUsd: event.refundAmountUsd,
        percentage: event.refundPercentage,
        reason: `Booking ${event.reference} cancelled`,
      });
    } catch (error) {
      // Logged at error with the ids needed to reconcile by hand. Rethrowing
      // would only produce an unhandled rejection — the HTTP response for the
      // cancellation has already been sent.
      this.logger.error('Refund failed after cancellation', {
        bookingId: event.bookingId,
        reference: event.reference,
        amountUsd: event.refundAmountUsd,
        error: (error as Error).message,
      });
    }
  }
}
