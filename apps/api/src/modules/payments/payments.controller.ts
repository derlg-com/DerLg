import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { PaymentIntentView, PaymentsService } from './payments.service';
import { RefundDecision } from './refund-policy';
import { StripeService } from './stripe.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly stripe: StripeService,
  ) {}

  /**
   * Starts (or resumes) payment for a booking the caller owns. The amount is
   * read from the booking's frozen snapshot — the client cannot influence it.
   */
  @Post(':bookingId/intent')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Payment intent created')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  createIntent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<PaymentIntentView> {
    return this.payments.createIntent(user.id, bookingId);
  }

  /** What the traveller would get back if they cancelled right now. */
  @Post(':bookingId/refund-quote')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Refund quoted')
  quoteRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<RefundDecision> {
    return this.payments.quoteRefund(user.id, bookingId);
  }

  /**
   * Stripe webhook.
   *
   * Deliberately unauthenticated — Stripe cannot present a JWT — and protected
   * instead by HMAC signature verification over the *raw* body. `@RawResponse`
   * keeps the reply outside the envelope because Stripe only wants a 2xx.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @RawResponse()
  // Generous: Stripe retries with backoff and may burst after an outage.
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!request.rawBody) {
      // Without the raw bytes the signature cannot be verified, so refuse rather
      // than trusting a parsed body.
      throw new AppException(
        ErrorCode.PAYMENT_SIGNATURE_INVALID,
        'The webhook body could not be read for signature verification.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const event = this.stripe.constructWebhookEvent(request.rawBody, signature);
    await this.payments.handleEvent(event);

    return { received: true };
  }
}
