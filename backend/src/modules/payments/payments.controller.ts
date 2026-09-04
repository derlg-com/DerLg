import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/throttler/rate-limit';
import { PaymentsService } from './services/payments.service';
import {
  CreatePaymentIntentDto,
  PaymentStatusQueryDto,
} from './dto/payments.dto';

/**
 * Customer payment endpoints.
 *
 * Authenticated by the global `JwtAuthGuard`; every handler scopes its work to
 * `user.sub` so one traveller cannot start or read another's payment.
 */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * Starts a payment and returns what the client needs to complete it:
   * a Stripe `clientSecret` for cards, or a KHQR payload for ABA.
   *
   * Rate-limited at the payment tier. This creates a PaymentIntent at Stripe on
   * every accepted call, so an unbounded endpoint is both a way to spam a
   * merchant account and a way to run up API cost.
   */
  @Post('intents')
  @RateLimit('PAYMENT')
  createIntent(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return this.payments.startPayment(userId, dto.bookingId, dto.method);
  }

  /**
   * Current payment state for one of the caller's bookings.
   *
   * The client polls this: ABA settles out-of-band from a Telegram alert, and a
   * card can settle by webhook after the browser has moved on, so neither
   * outcome is knowable from the request that started the payment.
   *
   * Rate-limited more loosely than intent creation because polling is the
   * intended usage — it only reads.
   */
  @Get('status')
  @RateLimit('WRITE')
  getStatus(
    @CurrentUser('sub') userId: string,
    @Query() query: PaymentStatusQueryDto,
  ) {
    return this.payments.getStatus(userId, query.bookingId);
  }
}
