import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SupportedLanguage } from '@prisma/client';

export class ItineraryItemTranslationDto {
  @IsEnum(SupportedLanguage)
  language: SupportedLanguage;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class CreateItineraryItemDto {
  /** Validated against the parent trip's durationDays by the service. */
  @IsInt()
  @Min(1)
  @Max(60)
  dayNumber: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  sortOrder?: number;

  /** Existence is verified before linking; a bad id would otherwise 500 on FK. */
  @IsOptional()
  @IsUUID()
  placeId?: string;

  @IsOptional()
  @IsUUID()
  hotelId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ItineraryItemTranslationDto)
  translations: ItineraryItemTranslationDto[];
}

export class UpdateItineraryItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  dayNumber?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  sortOrder?: number;

  /**
   * `null` is meaningful here: it unlinks the place. `@IsOptional()` permits it,
   * and the service distinguishes null (clear) from undefined (leave alone).
   */
  @IsOptional()
  @IsUUID()
  placeId?: string | null;

  @IsOptional()
  @IsUUID()
  hotelId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ItineraryItemTranslationDto)
  translations?: ItineraryItemTranslationDto[];
}

export class ReorderItineraryEntryDto {
  @IsUUID()
  itemId: string;

  @IsInt()
  @Min(1)
  @Max(60)
  dayNumber: number;

  @IsInt()
  @Min(0)
  @Max(100)
  sortOrder: number;
}

/**
 * A whole-itinerary reorder in one request.
 *
 * Batched deliberately: dragging one stop shifts the sortOrder of its siblings,
 * so sending them individually would leave the itinerary transiently inconsistent
 * and cost one round trip per item.
 */
export class ReorderItineraryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReorderItineraryEntryDto)
  items: ReorderItineraryEntryDto[];
}

/** Replaces the trip's guide set wholesale (Prisma `set` semantics). */
export class SetTripGuidesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  guideIds: string[];
}
