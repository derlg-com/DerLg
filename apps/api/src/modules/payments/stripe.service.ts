import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';

/**
 * Thin wrapper around the Stripe SDK.
 *
 * The client is created lazily and the service reports `isConfigured` so the
 * whole application still boots without payment credentials — the payment
 * endpoints then answer with a clear 503 instead of the process failing at
 * startup, which matters for local development and for CI.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly secretKey?: string;
  private readonly webhookSecret?: string;
  private client?: Stripe;

  constructor(config: ConfigService) {
    this.secretKey = config.get<string>('STRIPE_SECRET_KEY') || undefined;
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET') || undefined;

    if (!this.secretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not set — payment endpoints will return 503 until it is configured.',
      );
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.secretKey);
  }

  get canVerifyWebhooks(): boolean {
    return Boolean(this.webhookSecret);
  }

  /** Throws a 503 rather than a 500 when payments are not set up. */
  private requireClient(): Stripe {
    if (!this.secretKey) {
      throw new AppException(
        ErrorCode.PAYMENT_FAILED,
        'Card payments are not configured on this environment yet.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    this.client ??= new Stripe(this.secretKey, {
      // Pinned to the version this SDK release was built against, so webhook
      // payload shapes cannot shift underneath us on a Stripe rollout.
      apiVersion: '2026-07-29.dahlia',
      typescript: true,
      appInfo: { name: 'DerLg', version: '0.1.0' },
    });

    return this.client;
  }

  /**
   * Creates (or reuses) a Payment Intent. The idempotency key is derived from
   * the booking, so a double-clicked checkout button cannot create two charges.
   */
  async createPaymentIntent(input: {
    amountCents: number;
    currency: string;
    bookingId: string;
    bookingReference: string;
    customerEmail: string;
    idempotencyKey: string;
  }): Promise<Stripe.PaymentIntent> {
    const stripe = this.requireClient();

    return stripe.paymentIntents.create(
      {
        amount: input.amountCents,
        currency: input.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        receipt_email: input.customerEmail,
        description: `DerLg booking ${input.bookingReference}`,
        // Lets the webhook find the booking without trusting client input.
        metadata: {
          bookingId: input.bookingId,
          bookingReference: input.bookingReference,
        },
      },
      { idempotencyKey: input.idempotencyKey },
    );
  }

  async retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return this.requireClient().paymentIntents.retrieve(id);
  }

  async refund(input: {
    paymentIntentId: string;
    amountCents: number;
    reason?: Stripe.RefundCreateParams.Reason;
  }): Promise<Stripe.Refund> {
    return this.requireClient().refunds.create({
      payment_intent: input.paymentIntentId,
      amount: input.amountCents,
      ...(input.reason ? { reason: input.reason } : {}),
    });
  }

  /**
   * Verifies a webhook signature against the raw request body.
   *
   * This is the only thing standing between the internet and "mark this booking
   * paid", so an unverifiable payload is rejected outright — never parsed and
   * trusted.
   */
  constructWebhookEvent(rawBody: Buffer | string, signature: string | undefined): Stripe.Event {
    if (!this.webhookSecret) {
      throw new AppException(
        ErrorCode.PAYMENT_SIGNATURE_INVALID,
        'Webhook verification is not configured on this environment.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!signature) {
      throw new AppException(
        ErrorCode.PAYMENT_SIGNATURE_INVALID,
        'Missing Stripe signature.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return this.requireClient().webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (error) {
      this.logger.warn('Rejected a webhook with an invalid signature', {
        error: (error as Error).message,
      });
      throw new AppException(
        ErrorCode.PAYMENT_SIGNATURE_INVALID,
        'That webhook signature could not be verified.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
