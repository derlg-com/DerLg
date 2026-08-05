import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AvailabilityModule } from '../availability/availability.module';
import { CatalogModule } from '../catalog/catalog.module';
import { JourneysModule } from '../journeys/journeys.module';
import { BookingHoldSweeper } from './booking-hold.sweeper';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [AuthModule, CatalogModule, AvailabilityModule, JourneysModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingHoldSweeper],
  // Payments (Task 12) and the AI's create_booking_hold tool (Task 16) both
  // go through BookingsService rather than writing bookings themselves.
  exports: [BookingsService],
})
export class BookingsModule {}
