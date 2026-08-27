import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { DriverStatus } from '@prisma/client';

/**
 * Driver-selection filter for a broadcast.
 *
 * A closed shape rather than free-form JSON: the filter is turned into a Prisma
 * `where`, so accepting arbitrary keys would let a request steer the query.
 */
export class BroadcastTargetFilterDto {
  @IsOptional()
  @IsIn(Object.values(DriverStatus))
  status?: DriverStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;
}

export class AdminBroadcastDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096) // Telegram's own message ceiling.
  message: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BroadcastTargetFilterDto)
  targetFilter?: BroadcastTargetFilterDto;
}
