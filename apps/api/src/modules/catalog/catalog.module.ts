import { Module } from '@nestjs/common';

import { CatalogRefResolver } from './catalog-ref.resolver';
import {
  CitiesController,
  GuidesController,
  HotelsController,
  PlacesController,
  TransportsController,
} from './catalog.controllers';
import { CatalogService } from './catalog.service';
import { PackagesController } from './packages.controller';

@Module({
  controllers: [
    PackagesController,
    PlacesController,
    HotelsController,
    TransportsController,
    GuidesController,
    CitiesController,
  ],
  providers: [CatalogService, CatalogRefResolver],
  // Availability (Task 8), drafts (Task 9) and the AI tool registry (Task 14)
  // all read the catalogue through these two providers.
  exports: [CatalogService, CatalogRefResolver],
})
export class CatalogModule {}
