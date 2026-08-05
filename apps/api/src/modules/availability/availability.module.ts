import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [CatalogModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService, PricingService],
  // Drafts (Task 9), bookings (Task 11) and the AI tools (Tasks 14/16) all
  // price and check stock through these two services.
  exports: [AvailabilityService, PricingService],
})
export class AvailabilityModule {}
