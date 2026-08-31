import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TripCategory } from '@prisma/client';

/**
 * Query params for `GET /v1/admin/trips`.
 *
 * Every field is declared because the global ValidationPipe runs with
 * `forbidNonWhitelisted` — an undeclared param 400s the whole request.
 */
export class ListTripsAdminDto {
  /** Matches the trip title in any language (titles live on translation rows). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(TripCategory)
  category?: TripCategory;

  /**
   * A string, not a boolean: query params arrive as text. `isPublishedBool`
   * converts, and `undefined` means "both" rather than defaulting to false —
   * unpublished drafts are exactly what an admin needs to find.
   */
  @IsOptional()
  @IsBooleanString()
  isPublished?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  get isPublishedBool(): boolean | undefined {
    if (this.isPublished === undefined) return undefined;
    return this.isPublished === 'true';
  }
}
