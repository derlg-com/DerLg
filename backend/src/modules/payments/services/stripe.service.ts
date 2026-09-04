import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { ErrorCode } from '../../../common/errors/error-codes';

/** Smallest currency unit conversion. Stripe bills in cents for USD. */
const CENTS_PER_USD = 100;

/**
 * Thin wrapper around the Stripe SDK.
 *
 * Owns three concerns and nothing else: constructing the client, converting
 * to/from Stripe's integer-cents representation, and verifying webhook
 * signatures. Booking state transitions live in `PaymentsService` — this class
 * must stay swappable for a mock in tests.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;

  constructor(private readonly config: ConfigService) {}

  /** Whether card payments are available in this deployment. */
  isConfigured(): boolean {
    return (this.config.get<string>('STRIPE_SECRET_KEY') ?? '') !== '';
  }

  /**
   * Lazily constructs the client.
   *
   * Deliberately not in the constructor: an unset `STRIPE_SECRET_KEY` must not
   * stop the application from booting. The catalogue, the AI concierge and ABA
   * payments all work without Stripe, so a missing card processor degrades one
   * feature rather than the whole API.
   */
  private stripe(): Stripe {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: ErrorCode.PAY_METHOD_NOT_SUPPORTED,
        message: 'Card payments are not configured on this server',
      });
    }
    if (!this.client) {
      this.client = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
        // Pinned rather than floating: Stripe changes response shapes between
        // versions, and an implicit upgrade would alter webhook payloads under a
        // running deployment.
        apiVersion: '2025-10-29.clover',
        typescript: true,
        // Two retries on network failure. Stripe's client only retries requests
        // it knows are safe to repeat, and PaymentIntent creation carries an
        // idempotency key, so a retry cannot double-charge.
        maxNetworkRetries: 2,
      });
    }
    return this.client;
  }

  /**
   * Creates (or re-fetches) a PaymentIntent for a booking.
   *
   * `idempotencyKey` is required, not optional. A traveller double-tapping "Pay"
   * on a flaky mobile connection is the normal case here, and without a key each
   * tap creates a separate PaymentIntent — every one of which can be confirmed,
   * charging the customer twice for one booking. With a key, Stripe returns the
   * original intent.
   */
  async createPaymentIntent(input: {
    amountUsd: number;
    bookingId: string;
    bookingReference: string;
    userId: string;
    idempotencyKey: string;
  }): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe().paymentIntents.create(
        {
          amount: this.toCents(input.amountUsd),
          currency: 'usd',
          // Lets Stripe present whatever methods the account supports (cards,
          // wallets) without this service enumerating them.
          automatic_payment_methods: { enabled: true },
          // The webhook is the only thing that marks a booking paid, and it must
          // be able to find the booking from the event alone.
          metadata: {
            bookingId: input.bookingId,
            bookingReference: input.bookingReference,
            userId: input.userId,
          },
          description: `DerLg booking ${input.bookingReference}`,
        },
        { idempotencyKey: input.idempotencyKey },
      );
    } catch (error) {
      throw this.wrap(error, 'Failed to create the card payment');
    }
  }

  /** Reads back an intent, e.g. to reconcile a status the webhook has not delivered. */
  async getPaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe().paymentIntents.retrieve(id);
    } catch (error) {
      throw this.wrap(error, 'Failed to read the card payment');
    }
  }

  /**
   * Cancels an unconfirmed intent.
   *
   * Used when a booking's total changes after checkout has started: leaving the
   * old intent live would let the customer confirm it and pay the previous price.
   */
  async cancelPaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe().paymentIntents.cancel(id);
    } catch (error) {
      throw this.wrap(error, 'Failed to cancel the card payment');
    }
  }

  /**
   * Refunds part or all of a PaymentIntent.
   *
   * The idempotency key is derived from the intent and amount by the caller so a
   * retried cancellation cannot refund twice.
   */
  async refund(input: {
    paymentIntentId: string;
    amountUsd: number;
    reason: string;
    idempotencyKey: string;
  }): Promise<Stripe.Refund> {
    try {
      return await this.stripe().refunds.create(
        {
          payment_intent: input.paymentIntentId,
          amount: this.toCents(input.amountUsd),
          metadata: { reason: input.reason.slice(0, 500) },
        },
        { idempotencyKey: input.idempotencyKey },
      );
    } catch (error) {
      throw this.wrap(error, 'Failed to refund the card payment');
    }
  }

  /**
   * Verifies a webhook signature and returns the parsed event.
   *
   * Requires the **raw** request body. Signature verification is computed over
   * the exact bytes Stripe sent; a body that has been through `JSON.parse` and
   * re-serialised will not match, and re-ordering or whitespace differences are
   * enough to fail. `main.ts` enables `rawBody` for this reason.
   *
   * Fails closed when no signing secret is configured. An unverified webhook is
   * an unauthenticated "mark this booking as paid" endpoint, so there is no safe
   * degraded mode.
   */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    if (secret === '') {
      this.logger.error(
        'STRIPE_WEBHOOK_SECRET is not configured; rejecting webhook delivery',
      );
      throw new ServiceUnavailableException({
        code: ErrorCode.PAY_WEBHOOK_INVALID,
        message: 'Webhook verification is not configured',
      });
    }
    // Throws on a bad signature; the caller maps that to 400 so Stripe retries.
    return this.stripe().webhooks.constructEvent(rawBody, signature, secret);
  }

  /** USD → integer cents. Rounded, because floats do not divide cleanly. */
  toCents(amountUsd: number): number {
    const cents = Math.round(amountUsd * CENTS_PER_USD);
    if (cents <= 0) {
      throw new Error(`Refusing to charge a non-positive amount: ${amountUsd}`);
    }
    return cents;
  }

  /** Integer cents → USD. */
  fromCents(amountCents: number): number {
    return amountCents / CENTS_PER_USD;
  }

  /**
   * Converts a Stripe error into a domain exception.
   *
   * Stripe's own message is forwarded only for card errors, which are written for
   * end users ("Your card was declined."). Everything else — API keys, rate
   * limits, malformed requests — is a server-side fault whose message can name
   * internal detail, so it is logged and replaced.
   *
   * Exceptions we raised ourselves pass straight through. `stripe()` throws
   * `PAY_METHOD_NOT_SUPPORTED` when the account is unconfigured, and that throw
   * happens inside the same `try` as the API call — so without this check the
   * wrapper relabelled it `PAY_STRIPE_ERROR`, and the client, which branches on
   * the code to show "card payments unavailable", fell through to a generic error.
   */
  private wrap(error: unknown, fallback: string): HttpException {
    if (error instanceof HttpException) return error;

    const stripeError = error as Stripe.errors.StripeError;
    const isCardError = stripeError?.type === 'StripeCardError';

    this.logger.error('Stripe request failed', {
      type: stripeError?.type,
      code: stripeError?.code,
      requestId: stripeError?.requestId,
    });

    return new ServiceUnavailableException({
      code: isCardError
        ? ErrorCode.PAY_INTENT_FAILED
        : ErrorCode.PAY_STRIPE_ERROR,
      message: isCardError ? (stripeError.message ?? fallback) : fallback,
    });
  }
}
