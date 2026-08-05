import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { BookingStatus, PaymentStatus, Prisma } from '@prisma/client';
import type Stripe from 'stripe';

import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { BookingsService } from '../bookings/bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { RefundDecision, decideRefund } from './refund-policy';
import { StripeService } from './stripe.service';

export interface PaymentIntentView {
  paymentId: string;
  clientSecret: string;
  amountCents: number;
  currency: string;
  bookingReference: string;
  publishableKey: string | null;
}

/** Statuses from which starting a payment makes sense. */
const PAYABLE_STATUSES: BookingStatus[] = [BookingStatus.HOLD, BookingStatus.PENDING_PAYMENT];

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly bookings: BookingsService,
    private readonly publishableKey: string | null,
  ) {}

  /**
   * Starts (or resumes) payment for a booking.
   *
   * The amount comes from the booking's frozen snapshot, never from the client.
   * Reusing an existing intent means a reloaded checkout page does not create a
   * second charge.
   */
  async createIntent(userId: string, bookingId: string): Promise<PaymentIntentView> {
    const booking = await this.bookings.loadOwned(userId, bookingId);

    if (!PAYABLE_STATUSES.includes(booking.status)) {
      throw new AppException(
        ErrorCode.BOOKING_INVALID_STATE,
        booking.status === BookingStatus.CONFIRMED
          ? 'That booking is already paid for.'
          : `A ${booking.status.toLowerCase().replace('_', ' ')} booking cannot be paid for.`,
        HttpStatus.CONFLICT,
        { status: booking.status },
      );
    }

    if (booking.holdExpiresAt && booking.holdExpiresAt.getTime() <= Date.now()) {
      throw new AppException(
        ErrorCode.BOOKING_HOLD_EXPIRED,
        'That hold has expired. Please start again to get fresh availability.',
        HttpStatus.CONFLICT,
      );
    }

    const existing = await this.prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        status: { in: [PaymentStatus.REQUIRES_PAYMENT, PaymentStatus.PROCESSING] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, stripePaymentIntentId: true, amountCents: true, currency: true },
    });

    // Resume an in-flight intent when the amount still matches.
    if (existing?.stripePaymentIntentId && existing.amountCents === booking.totalCents) {
      const intent = await this.stripe.retrievePaymentIntent(existing.stripePaymentIntentId);
      if (intent.client_secret && intent.status !== 'canceled') {
        return {
          paymentId: existing.id,
          clientSecret: intent.client_secret,
          amountCents: existing.amountCents,
          currency: existing.currency,
          bookingReference: booking.reference,
          publishableKey: this.publishableKey,
        };
      }
    }

    const intent = await this.stripe.createPaymentIntent({
      amountCents: booking.totalCents,
      currency: booking.currency,
      bookingId: booking.id,
      bookingReference: booking.reference,
      customerEmail: booking.contactEmail,
      // Stable per booking+amount, so retries collapse onto one intent.
      idempotencyKey: `booking-${booking.id}-${booking.totalCents}`,
    });

    if (!intent.client_secret) {
      throw new AppException(
        ErrorCode.PAYMENT_FAILED,
        'Stripe did not return a client secret.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const payment = await this.prisma.payment.upsert({
      where: { stripePaymentIntentId: intent.id },
      create: {
        bookingId: booking.id,
        provider: 'stripe',
        stripePaymentIntentId: intent.id,
        status: PaymentStatus.REQUIRES_PAYMENT,
        amountCents: booking.totalCents,
        currency: booking.currency,
      },
      update: { amountCents: booking.totalCents, status: PaymentStatus.REQUIRES_PAYMENT },
      select: { id: true },
    });

    await this.bookings.markPendingPayment(booking.id);

    this.logger.log('Payment intent created', {
      bookingId: booking.id,
      reference: booking.reference,
      paymentId: payment.id,
      amountCents: booking.totalCents,
    });

    return {
      paymentId: payment.id,
      clientSecret: intent.client_secret,
      amountCents: booking.totalCents,
      currency: booking.currency,
      bookingReference: booking.reference,
      publishableKey: this.publishableKey,
    };
  }

  /**
   * Applies a verified Stripe event.
   *
   * Idempotent by design: Stripe retries webhooks, and a `succeeded` event that
   * arrives twice must not confirm twice or refund anything.
   */
  async handleEvent(event: Stripe.Event): Promise<{ handled: boolean; bookingId?: string }> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        return this.onSucceeded(event.data.object);
      case 'payment_intent.payment_failed':
        return this.onFailed(event.data.object);
      case 'payment_intent.canceled':
        return this.onCanceled(event.data.object);
      default:
        this.logger.debug(`Ignoring unhandled Stripe event ${event.type}`);
        return { handled: false };
    }
  }

  private async onSucceeded(intent: Stripe.PaymentIntent) {
    const payment = await this.paymentFor(intent);
    if (!payment) {
      return { handled: false };
    }

    if (payment.status === PaymentStatus.SUCCEEDED) {
      // Stripe replayed the event; nothing left to do.
      this.logger.log('Ignoring duplicate succeeded webhook', { paymentId: payment.id });
      return { handled: true, bookingId: payment.bookingId };
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.SUCCEEDED, failureReason: null },
    });

    if (payment.booking.status !== BookingStatus.CONFIRMED) {
      await this.bookings.markConfirmed(payment.bookingId);
    }

    this.logger.log('Payment succeeded', {
      paymentId: payment.id,
      bookingId: payment.bookingId,
      reference: payment.booking.reference,
    });

    return { handled: true, bookingId: payment.bookingId };
  }

  private async onFailed(intent: Stripe.PaymentIntent) {
    const payment = await this.paymentFor(intent);
    if (!payment) {
      return { handled: false };
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        failureReason: intent.last_payment_error?.message ?? 'The card was declined.',
      },
    });

    // The hold is deliberately left alone: the traveller can retry with another
    // card until the fifteen minutes run out.
    this.logger.warn('Payment failed', {
      paymentId: payment.id,
      bookingId: payment.bookingId,
      reason: intent.last_payment_error?.code,
    });

    return { handled: true, bookingId: payment.bookingId };
  }

  private async onCanceled(intent: Stripe.PaymentIntent) {
    const payment = await this.paymentFor(intent);
    if (!payment) {
      return { handled: false };
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED, failureReason: 'The payment was cancelled.' },
    });

    return { handled: true, bookingId: payment.bookingId };
  }

  private paymentFor(intent: Stripe.PaymentIntent) {
    return this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: intent.id },
      select: {
        id: true,
        bookingId: true,
        status: true,
        amountCents: true,
        booking: { select: { status: true, reference: true } },
      },
    });
  }

  /** What a traveller would get back if they cancelled this booking now. */
  async quoteRefund(userId: string, bookingId: string): Promise<RefundDecision> {
    const booking = await this.bookings.loadOwned(userId, bookingId);
    const paid = await this.prisma.payment.findFirst({
      where: { bookingId: booking.id, status: PaymentStatus.SUCCEEDED },
      select: { amountCents: true, refundedCents: true },
    });

    return decideRefund({
      paidCents: (paid?.amountCents ?? 0) - (paid?.refundedCents ?? 0),
      startDate: booking.startDate,
    });
  }

  /**
   * Cancels a paid booking and refunds according to the tier policy. Cancelling
   * an unpaid hold needs no refund and goes straight through BookingsService.
   */
  async cancelWithRefund(userId: string, bookingId: string) {
    const booking = await this.bookings.loadOwned(userId, bookingId);
    const paid = await this.prisma.payment.findFirst({
      where: { bookingId: booking.id, status: PaymentStatus.SUCCEEDED },
      select: { id: true, stripePaymentIntentId: true, amountCents: true, refundedCents: true },
    });

    const decision = decideRefund({
      paidCents: (paid?.amountCents ?? 0) - (paid?.refundedCents ?? 0),
      startDate: booking.startDate,
    });

    if (paid?.stripePaymentIntentId && decision.amountCents > 0) {
      await this.stripe.refund({
        paymentIntentId: paid.stripePaymentIntentId,
        amountCents: decision.amountCents,
        reason: 'requested_by_customer',
      });

      await this.prisma.payment.update({
        where: { id: paid.id },
        data: {
          refundedCents: { increment: decision.amountCents },
          status:
            decision.amountCents >= paid.amountCents - paid.refundedCents
              ? PaymentStatus.REFUNDED
              : PaymentStatus.SUCCEEDED,
        },
      });

      this.logger.log('Refund issued', {
        bookingId: booking.id,
        tier: decision.tier,
        amountCents: decision.amountCents,
      });
    }

    const cancelled = await this.bookings.cancel(userId, bookingId);
    return { booking: cancelled, refund: decision };
  }

  /** Exposed for the webhook controller's structured logging. */
  static isKnownDuplicate(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    );
  }
}
