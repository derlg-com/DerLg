import { Module } from '@nestjs/common';

import { MinioService } from './minio.service';
import { AdminUploadController, StorageController } from './storage.controller';

/**
 * MinIO-backed object storage.
 *
 * MinIO is self-hosted in Docker (`derlg-minio`), not a third-party cloud
 * service. Clients never talk to it directly: the backend issues short-lived
 * presigned URLs so credentials stay server-side.
 */
@Module({
  controllers: [StorageController, AdminUploadController],
  providers: [MinioService],
  exports: [MinioService],
})
export class StorageModule {}
