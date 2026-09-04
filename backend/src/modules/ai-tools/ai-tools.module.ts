import { Module } from '@nestjs/common';
import { AiToolsController } from './ai-tools.controller';
import { AiToolsService } from './ai-tools.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';

/**
 * Tool surface for the Vibe Booking AI agent.
 *
 * Imports `PaymentsModule` so the agent's payment-QR tool uses the same KHQR
 * builder and the same `payments` rows as the web checkout. It previously built
 * its own pseudo-QR string, which meant the concierge and the website disagreed
 * about what a payment was.
 */
@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [AiToolsController],
  providers: [AiToolsService],
})
export class AiToolsModule {}
