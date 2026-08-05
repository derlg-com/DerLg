import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AvailabilityModule } from '../availability/availability.module';
import { CatalogModule } from '../catalog/catalog.module';
import { JourneyDraftsController } from './journey-drafts.controller';
import { JourneyDraftsService } from './journey-drafts.service';

@Module({
  imports: [AuthModule, CatalogModule, AvailabilityModule],
  controllers: [JourneyDraftsController],
  providers: [JourneyDraftsService],
  // Bookings (Task 11) and the AI composer (Task 16) both create drafts.
  exports: [JourneyDraftsService],
})
export class JourneysModule {}
