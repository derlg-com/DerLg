import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import * as QRCode from 'qrcode';
import type Stripe from 'stripe';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ReleaseHoldUtil } from '../../bookings/utils';
import { AbaKhqrService, type AbaCreditAlert } from './aba-khqr.service';
import { StripeService } from './stripe.service';
import { PaymentMethod } from '../dto/payments.dto';

/** Booking states from which a customer may still start a payment. */
const PAYABLE: BookingStatus[] = [
  BookingStatus.hold,
  BookingStatus.pending_payment,
  BookingStatus.payment_failed,
];

/** Shape returned to the client when a payment is started. */
export interface StartPaymentResult {
  paymentId: string;
  bookingId: string;
  bookingReference: string;
  method: PaymentMethod;
  amountUsd: number;
  status: PaymentStatus;
  /** Card only: passed to Stripe.js to confirm on the client. */
  clientSecret?: string;
  /** ABA only: the KHQR string, and a PNG rendering of it. */
  qrPayload?: string;
  qrImageDataUrl?: string;
  expiresAt?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly stripe: StripeService,
    private readonly aba: AbaKhqrService,
    private readonly releaseHold: ReleaseHoldUtil,
  ) {}

  // -------------------------------------------------------------------------
  // Starting a payment
  // -------------------------------------------------------------------------

  /**
   * Begins payment for a booking the caller owns.
   *
   * Both methods share the same guards — ownership, a payable status, an unexpired
   * hold — and then diverge only in how the customer is asked for money.
   */
  async startPayment(
    userId: string,
    bookingId: string,
    method: PaymentMethod,
  ): Promise<StartPaymentResult> {
    const booking = await this.loadPayableBooking(userId, bookingId);

    return method === PaymentMethod.CARD
      ? this.startCardPayment(booking)
      : this.startAbaPayment(booking);
  }

  /**
   * Loads a booking and asserts it can still be paid for.
   *
   * The hold expiry is checked here rather than trusted from the status column:
   * the expiry sweep is a Redis TTL, so between a hold lapsing and the sweep
   * running, `status` still reads `hold`. Charging for inventory that has already
   * been released is worse than making the customer start again.
   */
  private async loadPayableBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        reference: true,
        status: true,
        totalUsd: true,
        expiresAt: true,
      },
    });

    if (!booking) {
      throw new NotFoundException({
        code: ErrorCode.BKNG_NOT_FOUND,
        message: 'Booking not found',
      });
    }
    if (booking.userId !== userId) {
      throw new ForbiddenException({
        code: ErrorCode.BKNG_NOT_AUTHOR,
        message: 'Not your booking',
      });
    }
    if (
      booking.status === BookingStatus.confirmed ||
      booking.status === BookingStatus.completed
    ) {
      throw new BadRequestException({
        code: ErrorCode.BKNG_CONFIRMED_CANNOT_MODIFY,
        message: 'This booking is already paid',
      });
    }
    if (!PAYABLE.includes(booking.status)) {
      throw new BadRequestException({
        code: ErrorCode.BKNG_EXPIRED,
        message: `A ${booking.status} booking cannot be paid for`,
      });
    }
    if (booking.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: ErrorCode.BKNG_EXPIRED,
        message: 'The hold on this booking has expired',
      });
    }
    if (Number(booking.totalUsd) <= 0) {
      throw new BadRequestException({
        code: ErrorCode.PAY_AMOUNT_MISMATCH,
        message: 'This booking has no payable amount',
      });
    }

    return booking;
  }

  /**
   * Creates or reuses a Stripe PaymentIntent.
   *
   * One pending intent per booking. Re-entering checkout returns the existing
   * `clientSecret` instead of minting a second intent — two live intents for one
   * booking is how a customer ends up charged twice.
   */
  private async startCardPayment(booking: {
    id: string;
    userId: string;
    reference: string;
    totalUsd: Prisma.Decimal;
  }): Promise<StartPaymentResult> {
    const amountUsd = Number(booking.totalUsd);

    const existing = await this.prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        provider: PaymentProvider.stripe,
        status: { in: [PaymentStatus.pending, PaymentStatus.processing] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing?.stripePaymentIntentId && existing.clientSecret) {
      // Amount can change if the booking was modified after the intent was made.
      if (Number(existing.amountUsd) === amountUsd) {
        return this.toCardResult(existing, amountUsd, booking.reference);
      }
      // Stale intent: cancel it so it cannot be confirmed for the old amount.
      await this.voidStaleIntent(existing.id, existing.stripePaymentIntentId);
    }

    // Derived, not random: the same booking and amount must always produce the
    // same key so a retried request reuses the intent rather than creating one.
    const idempotencyKey = `pi:${booking.id}:${this.stripe.toCents(amountUsd)}`;

    const intent = await this.stripe.createPaymentIntent({
      amountUsd,
      bookingId: booking.id,
      bookingReference: booking.reference,
      userId: booking.userId,
      idempotencyKey,
    });

    const payment = await this.prisma.payment.upsert({
      where: { idempotencyKey },
      create: {
        bookingId: booking.id,
        userId: booking.userId,
        provider: PaymentProvider.stripe,
        amountUsd,
        currency: 'usd',
        status: PaymentStatus.pending,
        stripePaymentIntentId: intent.id,
        clientSecret: intent.client_secret,
        idempotencyKey,
      },
      update: {
        stripePaymentIntentId: intent.id,
        clientSecret: intent.client_secret,
      },
    });

    // hold → pending_payment records that the customer has committed to paying.
    await this.markPendingPayment(booking.id);

    return this.toCardResult(payment, amountUsd, booking.reference);
  }

  /**
   * Generates a dynamic ABA KHQR.
   *
   * Unlike the card flow, an unexpired QR is returned as-is: the payload encodes
   * its own expiry and CRC, so regenerating it would invalidate the code the
   * customer may already be scanning.
   */
  private async startAbaPayment(booking: {
    id: string;
    userId: string;
    reference: string;
    totalUsd: Prisma.Decimal;
  }): Promise<StartPaymentResult> {
    if (!this.aba.isConfigured()) {
      throw new BadRequestException({
        code: ErrorCode.PAY_METHOD_NOT_SUPPORTED,
        message: 'ABA payments are not configured on this server',
      });
    }

    const amountUsd = Number(booking.totalUsd);

    const existing = await this.prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        provider: PaymentProvider.aba,
        status: PaymentStatus.pending,
        qrExpiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing?.qrPayload && Number(existing.amountUsd) === amountUsd) {
      return this.toAbaResult(existing, amountUsd, booking.reference);
    }

    const { payload, expiresAt } = this.aba.buildDynamicQr(amountUsd);

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        userId: booking.userId,
        provider: PaymentProvider.aba,
        amountUsd,
        currency: 'usd',
        status: PaymentStatus.pending,
        qrPayload: payload,
        qrExpiresAt: expiresAt,
      },
    });

    await this.markPendingPayment(booking.id);

    return this.toAbaResult(payment, amountUsd, booking.reference);
  }

  // -------------------------------------------------------------------------
  // Reading status
  // -------------------------------------------------------------------------

  /**
   * Latest payment state for a booking the caller owns.
   *
   * Ownership is part of the `where` clause, so someone else's booking is
   * indistinguishable from a non-existent one.
   */
  async getStatus(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId, deletedAt: null },
      select: {
        id: true,
        status: true,
        totalUsd: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            provider: true,
            status: true,
            amountUsd: true,
            paidAt: true,
            qrExpiresAt: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException({
        code: ErrorCode.BKNG_NOT_FOUND,
        message: 'Booking not found',
      });
    }

    const payment = booking.payments[0];

    return {
      booking_id: booking.id,
      booking_status: booking.status,
      payment_intent_id: payment?.id ?? null,
      status: payment?.status ?? PaymentStatus.pending,
      amount_usd: payment
        ? Number(payment.amountUsd)
        : Number(booking.totalUsd),
      method: payment?.provider ?? null,
      paid_at: payment?.paidAt?.toISOString() ?? null,
      qr_expires_at: payment?.qrExpiresAt?.toISOString() ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Settlement — Stripe
  // -------------------------------------------------------------------------

  /**
   * Applies a verified Stripe event.
   *
   * Signature verification happens in the controller; by here the event is
   * trusted. Unknown event types are acknowledged rather than rejected — Stripe
   * retries any non-2xx, so a 400 for an event we simply do not handle would put
   * that event into an infinite retry loop.
   */
  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.onIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await this.onIntentFailed(event.data.object);
        break;
      case 'charge.refunded':
        await this.onChargeRefunded(event.data.object);
        break;
      default:
        this.logger.debug('Ignoring unhandled Stripe event', {
          type: event.type,
        });
    }
  }

  private async onIntentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: intent.id },
    });

    if (!payment) {
      // Not an error worth retrying: an intent with no local row was created
      // outside this system, or its booking was hard-deleted.
      this.logger.warn('Stripe success for an unknown PaymentIntent', {
        paymentIntentId: intent.id,
      });
      return;
    }
    if (payment.status === PaymentStatus.succeeded) return; // redelivery

    // Never trust the event's amount over our own record. A mismatch means the
    // intent was tampered with or created elsewhere, so it must not settle.
    const paidUsd = this.stripe.fromCents(
      intent.amount_received ?? intent.amount,
    );
    if (paidUsd + 0.001 < Number(payment.amountUsd)) {
      this.logger.error('Stripe reported an underpayment; not confirming', {
        paymentId: payment.id,
        expectedUsd: Number(payment.amountUsd),
        paidUsd,
      });
      return;
    }

    await this.settle({
      paymentId: payment.id,
      bookingId: payment.bookingId,
      providerPaymentId: this.chargeIdOf(intent) ?? intent.id,
    });

    this.logger.log('Card payment settled', {
      paymentId: payment.id,
      bookingId: payment.bookingId,
    });
  }

  private async onIntentFailed(intent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: intent.id },
      select: { id: true, bookingId: true, status: true },
    });
    if (!payment || payment.status === PaymentStatus.succeeded) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.failed },
      });
      // The hold is deliberately NOT released: the customer can retry with
      // another card for as long as it lasts.
      await tx.booking.updateMany({
        where: { id: payment.bookingId, status: BookingStatus.pending_payment },
        data: { status: BookingStatus.payment_failed },
      });
    });

    this.logger.warn('Card payment failed', {
      paymentId: payment.id,
      reason: intent.last_payment_error?.code,
    });
  }

  /**
   * Records a refund initiated outside this application (e.g. from the Stripe
   * dashboard) so our totals do not drift from Stripe's.
   */
  private async onChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const intentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (!intentId) return;

    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: intentId },
      select: { id: true, amountUsd: true },
    });
    if (!payment) return;

    const refundedUsd = this.stripe.fromCents(charge.amount_refunded);
    const fullyRefunded = refundedUsd >= Number(payment.amountUsd);

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        refundedAmountUsd: refundedUsd,
        status: fullyRefunded
          ? PaymentStatus.refunded
          : PaymentStatus.partially_refunded,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Settlement — ABA
  // -------------------------------------------------------------------------

  /**
   * Settles an ABA payment from a parsed credit alert.
   *
   * Matching is on amount alone, because that is all ABA's alert gives us that
   * we also know in advance. Two safeguards make that acceptable:
   *
   *  1. **Transaction-id de-duplication.** The trx id is written to
   *     `provider_payment_id`, which is unique, so a replayed alert cannot settle
   *     a second booking.
   *  2. **Ambiguity refuses to guess.** If two pending payments share the amount,
   *     nothing is settled and an operator is alerted. Settling the "newest" would
   *     be a coin flip that confirms one stranger's booking with another's money.
   *
   * @returns the settled payment id, or null when nothing was settled.
   */
  async settleAbaAlert(alert: AbaCreditAlert): Promise<string | null> {
    // Cheap pre-check before touching Postgres. The unique index is the real
    // guarantee; this just avoids work on the common redelivery case.
    const firstSeen = await this.redis
      .getClient()
      .set(`aba:trx:${alert.trxId}`, '1', 'EX', 7 * 24 * 60 * 60, 'NX');
    if (firstSeen === null) {
      this.logger.debug('Ignoring already-processed ABA alert', {
        trxId: alert.trxId,
      });
      return null;
    }

    const candidates = await this.prisma.payment.findMany({
      where: {
        provider: PaymentProvider.aba,
        status: PaymentStatus.pending,
        amountUsd: alert.amountUsd,
        qrExpiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, bookingId: true, amountUsd: true },
    });

    if (candidates.length === 0) {
      this.logger.warn('ABA credit alert matched no pending payment', {
        amountUsd: alert.amountUsd,
        trxId: alert.trxId,
      });
      await this.notifyOperators('ABA_PAYMENT_UNMATCHED', {
        amountUsd: alert.amountUsd,
        trxId: alert.trxId,
        phoneSuffix: alert.phoneSuffix,
      });
      return null;
    }

    if (candidates.length > 1) {
      this.logger.error(
        'ABA credit alert is ambiguous; refusing to settle automatically',
        {
          amountUsd: alert.amountUsd,
          trxId: alert.trxId,
          candidatePaymentIds: candidates.map((c) => c.id),
        },
      );
      await this.notifyOperators('ABA_PAYMENT_AMBIGUOUS', {
        amountUsd: alert.amountUsd,
        trxId: alert.trxId,
        candidatePaymentIds: candidates.map((c) => c.id),
      });
      return null;
    }

    const [match] = candidates;
    await this.settle({
      paymentId: match.id,
      bookingId: match.bookingId,
      providerPaymentId: `aba_${alert.trxId}`,
    });

    this.logger.log('ABA payment settled from Telegram alert', {
      paymentId: match.id,
      bookingId: match.bookingId,
      trxId: alert.trxId,
    });

    return match.id;
  }

  // -------------------------------------------------------------------------
  // Refunds
  // -------------------------------------------------------------------------

  /**
   * Refunds a cancelled booking, where the original payment allows it.
   *
   * Card payments refund through Stripe. ABA has no refund API, so those are
   * recorded as `pending` for an operator to pay out manually — reporting a
   * refund as done when no money moved would be worse than flagging the work.
   */
  async refundForCancellation(input: {
    bookingId: string;
    amountUsd: number;
    percentage: number;
    reason: string;
  }): Promise<void> {
    if (input.amountUsd <= 0) return; // 0% tier: nothing to refund.

    const payment = await this.prisma.payment.findFirst({
      where: { bookingId: input.bookingId, status: PaymentStatus.succeeded },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) return; // Never paid: cancelling costs nothing.

    // Cap at what was actually taken, minus anything already returned.
    const refundable =
      Number(payment.amountUsd) - Number(payment.refundedAmountUsd);
    const amountUsd = Math.min(input.amountUsd, refundable);
    if (amountUsd <= 0) return;

    if (payment.provider === PaymentProvider.stripe) {
      if (!payment.stripePaymentIntentId) {
        this.logger.error('Card payment has no PaymentIntent id to refund', {
          paymentId: payment.id,
        });
        return;
      }
      const refund = await this.stripe.refund({
        paymentIntentId: payment.stripePaymentIntentId,
        amountUsd,
        reason: input.reason,
        idempotencyKey: `rf:${payment.id}:${this.stripe.toCents(amountUsd)}`,
      });

      await this.recordRefund(payment.id, {
        amountUsd,
        percentage: input.percentage,
        reason: input.reason,
        providerRefundId: refund.id,
        status: PaymentStatus.succeeded,
        alreadyRefundedUsd: Number(payment.refundedAmountUsd),
        totalUsd: Number(payment.amountUsd),
      });
      return;
    }

    // ABA: queue for manual payout.
    await this.recordRefund(payment.id, {
      amountUsd,
      percentage: input.percentage,
      reason: input.reason,
      providerRefundId: null,
      status: PaymentStatus.pending,
      alreadyRefundedUsd: Number(payment.refundedAmountUsd),
      totalUsd: Number(payment.amountUsd),
    });

    await this.notifyOperators('ABA_REFUND_REQUIRED', {
      paymentId: payment.id,
      bookingId: input.bookingId,
      amountUsd,
    });
  }

  // -------------------------------------------------------------------------
  // Manual intervention
  // -------------------------------------------------------------------------

  /**
   * Settles an ABA payment by hand, against a bank transaction an operator has
   * verified.
   *
   * This exists because `settleAbaAlert` deliberately refuses to guess. When two
   * pending payments share an amount, nothing is auto-settled and an operator is
   * alerted — without this method that customer's money would be stuck with no way
   * to release the booking, which would make the safe choice unusable in practice.
   *
   * Constrained on purpose:
   *
   *  - **ABA only.** Cards settle by webhook. A manual override for Stripe would be
   *    a way to confirm a booking Stripe never charged for.
   *  - **A real transaction id is required.** It is stored in
   *    `provider_payment_id`, which is unique, so the same bank transaction cannot
   *    be used to settle a second booking — and every manual settlement is
   *    traceable to a line on the ABA statement.
   *  - **Already-settled payments are rejected**, not silently accepted, so a
   *    double-click cannot look like two confirmations.
   */
  async settleManually(input: {
    paymentId: string;
    abaTrxId: string;
    adminUserId: string;
  }): Promise<{ paymentId: string; bookingId: string }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: input.paymentId },
      select: {
        id: true,
        bookingId: true,
        provider: true,
        status: true,
        amountUsd: true,
      },
    });

    if (!payment) {
      throw new NotFoundException({
        code: ErrorCode.PAY_NOT_FOUND,
        message: 'Payment not found',
      });
    }
    if (payment.provider !== PaymentProvider.aba) {
      throw new BadRequestException({
        code: ErrorCode.PAY_METHOD_NOT_SUPPORTED,
        message:
          'Only ABA payments can be settled manually. Card payments settle through the Stripe webhook.',
      });
    }
    if (payment.status === PaymentStatus.succeeded) {
      throw new BadRequestException({
        code: ErrorCode.PAY_AMOUNT_MISMATCH,
        message: 'This payment has already been settled',
      });
    }

    const providerPaymentId = `aba_${input.abaTrxId}`;
    const alreadyUsed = await this.prisma.payment.findUnique({
      where: { providerPaymentId },
      select: { id: true },
    });
    if (alreadyUsed && alreadyUsed.id !== payment.id) {
      throw new BadRequestException({
        code: ErrorCode.PAY_WEBHOOK_DUPLICATE,
        message: `ABA transaction ${input.abaTrxId} has already settled another payment`,
      });
    }

    await this.settle({
      paymentId: payment.id,
      bookingId: payment.bookingId,
      providerPaymentId,
    });

    // Also claim the trx id in Redis so a late-arriving Telegram alert for the
    // same transaction is ignored instead of being reported as unmatched.
    await this.redis
      .getClient()
      .set(`aba:trx:${input.abaTrxId}`, '1', 'EX', 7 * 24 * 60 * 60, 'NX');

    this.logger.warn('ABA payment settled manually by an operator', {
      paymentId: payment.id,
      bookingId: payment.bookingId,
      abaTrxId: input.abaTrxId,
      adminUserId: input.adminUserId,
      amountUsd: Number(payment.amountUsd),
    });

    return { paymentId: payment.id, bookingId: payment.bookingId };
  }

  /**
   * Marks a queued ABA refund as paid out.
   *
   * ABA has no refund API, so `refundForCancellation` writes a `pending` refund
   * row and leaves the payment's own `refunded_amount_usd` untouched — the books
   * must not show money returned before it was. This is the operator confirming
   * the transfer actually happened, which is the point at which those totals move.
   */
  async completeManualRefund(input: {
    refundId: string;
    providerRefundId: string;
    adminUserId: string;
  }): Promise<{ refundId: string; paymentId: string }> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: input.refundId },
      select: {
        id: true,
        status: true,
        amountUsd: true,
        payment: {
          select: {
            id: true,
            provider: true,
            amountUsd: true,
            refundedAmountUsd: true,
          },
        },
      },
    });

    if (!refund) {
      throw new NotFoundException({
        code: ErrorCode.PAY_NOT_FOUND,
        message: 'Refund not found',
      });
    }
    if (refund.status === PaymentStatus.succeeded) {
      throw new BadRequestException({
        code: ErrorCode.PAY_ALREADY_REFUNDED,
        message: 'This refund is already recorded as paid out',
      });
    }
    if (refund.payment.provider === PaymentProvider.stripe) {
      throw new BadRequestException({
        code: ErrorCode.PAY_METHOD_NOT_SUPPORTED,
        message:
          'Card refunds are processed by Stripe and settle automatically; there is nothing to confirm by hand.',
      });
    }

    const totalRefunded =
      Number(refund.payment.refundedAmountUsd) + Number(refund.amountUsd);

    await this.prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: PaymentStatus.succeeded,
          providerRefundId: input.providerRefundId,
          processedById: input.adminUserId,
        },
      });
      await tx.payment.update({
        where: { id: refund.payment.id },
        data: {
          refundedAmountUsd: totalRefunded,
          status:
            totalRefunded >= Number(refund.payment.amountUsd)
              ? PaymentStatus.refunded
              : PaymentStatus.partially_refunded,
        },
      });
    });

    this.logger.log('Manual refund payout confirmed', {
      refundId: refund.id,
      paymentId: refund.payment.id,
      adminUserId: input.adminUserId,
    });

    return { refundId: refund.id, paymentId: refund.payment.id };
  }

  // -------------------------------------------------------------------------
  // Shared internals
  // -------------------------------------------------------------------------

  /**
   * The one place a booking becomes paid.
   *
   * Both providers funnel through here so the payment row, the booking status and
   * the ticket QR always move together. `updateMany` with a status predicate makes
   * the booking transition conditional in SQL: two concurrent settlements cannot
   * both apply it.
   */
  private async settle(input: {
    paymentId: string;
    bookingId: string;
    providerPaymentId: string;
  }): Promise<void> {
    const ticketQrUrl = await this.renderTicketQr(input.bookingId);

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: input.paymentId },
        data: {
          status: PaymentStatus.succeeded,
          paidAt: new Date(),
          providerPaymentId: input.providerPaymentId,
        },
      });
      await tx.booking.updateMany({
        where: {
          id: input.bookingId,
          status: { in: PAYABLE },
        },
        data: {
          status: BookingStatus.confirmed,
          qrCodeUrl: ticketQrUrl,
        },
      });
    });

    // A confirmed booking owns its inventory outright; the TTL key would only
    // cause the expiry sweep to look at it again.
    await this.releaseHold.release(input.bookingId);
  }

  private async recordRefund(
    paymentId: string,
    input: {
      amountUsd: number;
      percentage: number;
      reason: string;
      providerRefundId: string | null;
      status: PaymentStatus;
      alreadyRefundedUsd: number;
      totalUsd: number;
    },
  ): Promise<void> {
    const totalRefunded = input.alreadyRefundedUsd + input.amountUsd;

    await this.prisma.$transaction(async (tx) => {
      await tx.refund.create({
        data: {
          paymentId,
          amountUsd: input.amountUsd,
          providerRefundId: input.providerRefundId,
          reason: input.reason,
          percentage: input.percentage,
          status: input.status,
        },
      });
      // Only a completed refund changes the payment's own totals; a pending
      // manual payout must not make the books look settled.
      if (input.status === PaymentStatus.succeeded) {
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            refundedAmountUsd: totalRefunded,
            status:
              totalRefunded >= input.totalUsd
                ? PaymentStatus.refunded
                : PaymentStatus.partially_refunded,
          },
        });
      }
    });
  }

  /** Moves a booking to `pending_payment`, tolerating a repeat call. */
  private async markPendingPayment(bookingId: string): Promise<void> {
    await this.prisma.booking.updateMany({
      where: { id: bookingId, status: BookingStatus.hold },
      data: { status: BookingStatus.pending_payment },
    });
  }

  /**
   * Cancels a PaymentIntent that no longer matches the booking total.
   *
   * Best-effort: if Stripe has already moved the intent to a state that cannot be
   * cancelled, the local row is still marked failed so it stops being reused.
   */
  private async voidStaleIntent(
    paymentId: string,
    intentId: string,
  ): Promise<void> {
    try {
      const intent = await this.stripe.getPaymentIntent(intentId);
      if (intent.status !== 'succeeded' && intent.status !== 'canceled') {
        await this.stripe.cancelPaymentIntent(intentId);
      }
    } catch (error) {
      this.logger.warn('Could not cancel a stale PaymentIntent', {
        intentId,
        error: (error as Error).message,
      });
    }
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.failed },
    });
  }

  /**
   * Renders the ticket QR as a data URL.
   *
   * Generated locally rather than through a public QR-image service: the previous
   * placeholder sent every booking reference to `api.qrserver.com`, which handed a
   * third party a log of who booked what and made ticket rendering depend on their
   * uptime.
   */
  private async renderTicketQr(bookingId: string): Promise<string | undefined> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { reference: true },
    });
    if (!booking) return undefined;

    try {
      return await QRCode.toDataURL(`DERLG-TICKET-${booking.reference}`, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 400,
      });
    } catch (error) {
      // A missing ticket QR must not block a settled payment.
      this.logger.warn('Ticket QR rendering failed', {
        bookingId,
        error: (error as Error).message,
      });
      return undefined;
    }
  }

  /** Renders a KHQR payload as a scannable PNG data URL. */
  async renderQrImage(payload: string): Promise<string | undefined> {
    try {
      return await QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 400,
      });
    } catch (error) {
      this.logger.warn('KHQR rendering failed', {
        error: (error as Error).message,
      });
      return undefined;
    }
  }

  /**
   * Publishes an operational event to the admin real-time channel.
   *
   * Payment exceptions need a human, and the alternative is a log line nobody
   * reads until a customer complains. Best-effort: a Redis failure must not undo
   * a settled payment.
   */
  private async notifyOperators(
    event: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.redis
        .getClient()
        .publish('admin_events', JSON.stringify({ event, ...data }));
    } catch (error) {
      this.logger.warn('Could not publish an operator alert', {
        event,
        error: (error as Error).message,
      });
    }
  }

  private chargeIdOf(intent: Stripe.PaymentIntent): string | null {
    const latest = (intent as { latest_charge?: string | { id: string } })
      .latest_charge;
    if (typeof latest === 'string') return latest;
    return latest?.id ?? null;
  }

  private toCardResult(
    payment: {
      id: string;
      bookingId: string;
      status: PaymentStatus;
      clientSecret: string | null;
    },
    amountUsd: number,
    reference: string,
  ): StartPaymentResult {
    return {
      paymentId: payment.id,
      bookingId: payment.bookingId,
      bookingReference: reference,
      method: PaymentMethod.CARD,
      amountUsd,
      status: payment.status,
      clientSecret: payment.clientSecret ?? undefined,
    };
  }

  private async toAbaResult(
    payment: {
      id: string;
      bookingId: string;
      status: PaymentStatus;
      qrPayload: string | null;
      qrExpiresAt: Date | null;
    },
    amountUsd: number,
    reference: string,
  ): Promise<StartPaymentResult> {
    return {
      paymentId: payment.id,
      bookingId: payment.bookingId,
      bookingReference: reference,
      method: PaymentMethod.ABA_QR,
      amountUsd,
      status: payment.status,
      qrPayload: payment.qrPayload ?? undefined,
      qrImageDataUrl: payment.qrPayload
        ? await this.renderQrImage(payment.qrPayload)
        : undefined,
      expiresAt: payment.qrExpiresAt?.toISOString(),
    };
  }
}
