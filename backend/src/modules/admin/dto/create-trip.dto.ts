import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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

export class CreateTripDto {
  @IsEnum(TripCategory)
  category: TripCategory;

  /** Bounds the itinerary: an item's dayNumber may not exceed this. */
  @IsInt()
  @Min(1)
  @Max(60)
  durationDays: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  basePriceUsd: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxCapacity?: number;

  /**
   * MinIO object keys from the presigned upload flow (`tours` bucket), not raw
   * URLs — the browser uploads directly and reports back the key.
   */
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

  /**
   * At least one translation, because a trip with none has no title anywhere.
   * Capped at the number of supported languages.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => TripTranslationDto)
  translations: TripTranslationDto[];

  /** Defaults to false: a new trip is a draft until explicitly published. */
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
