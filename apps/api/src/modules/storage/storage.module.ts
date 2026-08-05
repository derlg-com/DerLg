import { Global, Module } from '@nestjs/common';

import { StorageService } from './storage.service';

/**
 * Global so the image/seed/health modules can inject `StorageService` without
 * each importing this module — same pattern the codebase uses for cross-cutting
 * services. Mirrors LlmModule / PaymentsModule shape.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}