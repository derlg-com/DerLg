import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminRole } from '@prisma/client';
import { randomUUID } from 'crypto';

import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { MinioService } from './minio.service';
import {
  LegacyPresignedUploadDto,
  PresignedUrlDto,
} from './dto/presigned-url.dto';

/**
 * Presigned-URL endpoints for admin media.
 *
 * Protected by the global `JwtAuthGuard` plus `AdminRoleGuard` via
 * `@AdminRoles()`. These must never be public: a presigned PUT is a write
 * capability against object storage, and the `verifications` bucket holds
 * students' ID photographs.
 */
@Controller('admin/storage')
@AdminRoles(
  AdminRole.OPERATIONS_MANAGER,
  AdminRole.FLEET_MANAGER,
  AdminRole.SUPER_ADMIN,
)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class StorageController {
  constructor(private readonly minio: MinioService) {}

  @Post('presigned-upload')
  @HttpCode(HttpStatus.OK)
  presignedUpload(@Body() dto: PresignedUrlDto) {
    return this.minio.createPresignedUpload(dto.bucket, dto.objectKey);
  }

  @Post('presigned-download')
  @HttpCode(HttpStatus.OK)
  presignedDownload(@Body() dto: PresignedUrlDto) {
    return this.minio.createPresignedDownload(dto.bucket, dto.objectKey);
  }

  @Delete(':bucket/:objectKey')
  @HttpCode(HttpStatus.OK)
  @AdminRoles(AdminRole.SUPER_ADMIN)
  async remove(
    @Param('bucket') bucket: string,
    @Param('objectKey') objectKey: string,
  ) {
    await this.minio.removeObject(bucket, objectKey);
    return { deleted: true, bucket, objectKey };
  }
}

/**
 * Compatibility endpoint for the admin frontend's existing
 * `uploadApi.getPresignedUrl(fileName, contentType)` call, which had no backend
 * at all before this merge. It derives a collision-free object key and defaults
 * to the `tours` bucket.
 */
@Controller('admin/upload')
@AdminRoles(
  AdminRole.OPERATIONS_MANAGER,
  AdminRole.FLEET_MANAGER,
  AdminRole.SUPER_ADMIN,
)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class AdminUploadController {
  constructor(private readonly minio: MinioService) {}

  @Post('presigned')
  @HttpCode(HttpStatus.OK)
  presigned(@Body() dto: LegacyPresignedUploadDto) {
    // Strip any directory component the client sent, then prefix a UUID so two
    // uploads of "photo.jpg" cannot overwrite one another.
    const baseName = dto.fileName.split('/').pop() ?? dto.fileName;
    const safeName = baseName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
    const objectKey = `${randomUUID()}-${safeName}`;

    return this.minio.createPresignedUpload(dto.bucket ?? 'tours', objectKey);
  }
}
