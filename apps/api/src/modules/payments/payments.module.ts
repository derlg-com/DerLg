import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { BookingsService } from '../bookings/bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [AuthModule, BookingsModule],
  controllers: [PaymentsController],
  providers: [
    StripeService,
    {
      provide: PaymentsService,
      inject: [PrismaService, StripeService, BookingsService, ConfigService],
      useFactory: (
        prisma: PrismaService,
        stripe: StripeService,
        bookings: BookingsService,
        config: ConfigService,
      ) =>
        new PaymentsService(
          prisma,
          stripe,
          bookings,
          // The publishable key is safe to hand to the browser and is returned
          // with the intent so the frontend needs no separate config call.
          config.get<string>('STRIPE_PUBLISHABLE_KEY') || null,
        ),
    },
  ],
  exports: [PaymentsService, StripeService],
})
export class PaymentsModule {}
