import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { PaymentsController } from './payments.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { PaymentsService } from './services/payments.service';
import { StripeService } from './services/stripe.service';
import { AbaKhqrService } from './services/aba-khqr.service';
import { AbaTelegramListener } from './aba-telegram.listener';
import { RefundOnCancelListener } from './refund-on-cancel.listener';
import { ReleaseHoldUtil } from '../bookings/utils';

/**
 * Card payments (Stripe) and ABA Bank KHQR.
 *
 * Both providers are optional at runtime: with no `STRIPE_SECRET_KEY` the card
 * endpoints answer 503, and with no `ABA_STATIC_QR` the ABA endpoints do the same.
 * Neither absence prevents the application from booting, because the catalogue and
 * the AI concierge do not depend on taking money.
 *
 * `ReleaseHoldUtil` is provided directly rather than by importing `BookingsModule`:
 * bookings would then have to import payments back for refund-on-cancel, and Nest
 * cannot resolve a circular module graph without `forwardRef`. The util is a thin
 * Redis DEL wrapper with no state, so a second instance costs nothing.
 */
@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [PaymentsController, StripeWebhookController],
  providers: [
    PaymentsService,
    StripeService,
    AbaKhqrService,
    AbaTelegramListener,
    RefundOnCancelListener,
    ReleaseHoldUtil,
  ],
  exports: [PaymentsService, AbaKhqrService],
})
export class PaymentsModule {}
