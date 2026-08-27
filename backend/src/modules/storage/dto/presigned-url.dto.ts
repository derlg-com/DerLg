import {
  IsIn,
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
} from 'class-validator';

import { STORAGE_BUCKETS } from '../minio.service';

/**
 * Request for a presigned upload or download URL.
 *
 * The bucket is constrained by `@IsIn` at the DTO layer *and* re-checked in
 * MinioService, because the service is also reachable from server-side callers
 * that bypass validation pipes.
 */
export class PresignedUrlDto {
  @IsString()
  @IsIn(STORAGE_BUCKETS)
  bucket: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  objectKey: string;
}

/**
 * Legacy shape used by the admin frontend's `uploadApi.getPresignedUrl`, which
 * sends `fileName` + `contentType` and no bucket.
 */
export class LegacyPresignedUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  fileName: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  contentType?: string;

  @IsString()
  @IsOptional()
  @IsIn(STORAGE_BUCKETS)
  bucket?: string;
}
