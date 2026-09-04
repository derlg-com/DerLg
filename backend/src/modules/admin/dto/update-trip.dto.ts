import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TripCategory } from '@prisma/client';

import { TripTranslationDto } from './trip-translation.dto';

/**
 * Every field optional — a PATCH may carry a single price change.
 *
 * Not `PartialType(CreateTripDto)`: `translations` needs different semantics
 * here. On update the array is an upsert list keyed on language, so omitting a
 * language leaves it untouched rather than deleting it.
 */
export class UpdateTripDto {
  @IsOptional()
  @IsEnum(TripCategory)
  category?: TripCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  durationDays?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  basePriceUsd?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxCapacity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  @MaxLength(500, { each: true })
  images?: string[];

  /** Upserted on [tripId, language]; omitted languages are left alone. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => TripTranslationDto)
  translations?: TripTranslationDto[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class PublishTripDto {
  @IsBoolean()
  isPublished: boolean;
}
