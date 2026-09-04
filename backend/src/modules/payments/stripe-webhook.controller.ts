import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';

import { Public } from '../../common/decorators/public.decorator';
import { NoRateLimit } from '../../common/throttler/rate-limit';
import { ErrorCode } from '../../common/errors/error-codes';
import { PaymentsService } from './services/payments.service';
import { StripeService } from './services/stripe.service';

/** Express request augmented by Nest's `rawBody` option. */
interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Stripe webhook receiver.
 *
 * This is the **only** thing that marks a card payment as paid. The browser is
 * never trusted to report success: a client that confirms a PaymentIntent could
 * simply lie, and a customer who closes the tab mid-3DS would otherwise never get
 * their booking. Stripe's signed server-to-server callback is the authority.
 */
@Controller('payments/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly payments: PaymentsService,
  ) {}

  /**
   * `POST /v1/payments/stripe/webhook`
   *
   * - `@Public()` because Stripe holds no JWT. The HMAC signature over the raw
   *   body is the authentication, and it is verified before anything is read.
   * - `@NoRateLimit()` because Stripe retries any non-2xx with backoff for up to
   *   three days. A 429 during a traffic spike would delay confirmations for
   *   customers who have already paid, and the signature already bounds abuse.
   *
   * Returns 200 for anything successfully verified — including events we do not
   * handle — so Stripe stops retrying. 400 is reserved for a delivery that fails
   * verification, and 500 for a genuine processing failure that *should* be
   * retried.
   */
  @Public()
  @NoRateLimit()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handle(
    @Req() request: RawBodyRequest,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true }> {
    if (!signature) {
      throw new BadRequestException({
        code: ErrorCode.PAY_WEBHOOK_INVALID,
        message: 'Missing stripe-signature header',
      });
    }

    // Verification is byte-exact, so a re-serialised body cannot be used.
    // `rawBody` is enabled in main.ts; its absence is a wiring fault, not a
    // client error, and must fail rather than silently skip verification.
    const rawBody = request.rawBody;
    if (!rawBody) {
      this.logger.error(
        'Raw request body is unavailable; cannot verify the Stripe signature. ' +
          'NestFactory.create must be called with { rawBody: true }.',
      );
      throw new BadRequestException({
        code: ErrorCode.PAY_WEBHOOK_INVALID,
        message: 'Webhook could not be verified',
      });
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.constructWebhookEvent(rawBody, signature);
    } catch (error) {
      // A bad signature is either a misconfigured secret or a forgery attempt.
      // Logged without the body, which carries customer payment detail.
      this.logger.warn('Rejected a Stripe webhook with an invalid signature', {
        error: (error as Error).message,
      });
      throw new BadRequestException({
        code: ErrorCode.PAY_WEBHOOK_INVALID,
        message: 'Invalid webhook signature',
      });
    }

    await this.payments.handleStripeEvent(event);

    return { received: true };
  }
}
