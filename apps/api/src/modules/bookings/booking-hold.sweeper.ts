import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { BookingsService } from './bookings.service';

/**
 * Releases inventory from holds nobody paid for.
 *
 * Availability already ignores EXPIRED bookings, so a lapsed hold stops
 * blocking stock the moment its window closes even before this runs — the
 * sweeper's job is to make the *status* honest so travellers and support see
 * "expired" rather than a hold that will never complete.
 */
@Injectable()
export class BookingHoldSweeper {
  private readonly logger = new Logger(BookingHoldSweeper.name);

  constructor(private readonly bookings: BookingsService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'expire-booking-holds' })
  async sweep(): Promise<void> {
    try {
      const expired = await this.bookings.expireLapsedHolds();
      if (expired > 0) {
        this.logger.log(`Hold sweeper expired ${expired} booking(s)`);
      }
    } catch (error) {
      // A failed sweep must never crash the scheduler; the next tick retries.
      this.logger.error('Hold sweeper failed', { error: (error as Error).message });
    }
  }
}
