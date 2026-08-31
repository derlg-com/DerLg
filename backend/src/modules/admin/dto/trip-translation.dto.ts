import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SupportedLanguage } from '@prisma/client';

/**
 * One language's copy for a trip.
 *
 * Every user-facing string on a Trip lives here rather than on the trip itself,
 * so a trip with no translation row has no title at all. That is why publishing
 * is gated on the presence of a non-blank English title.
 */
export class TripTranslationDto {
  @IsEnum(SupportedLanguage)
  language: SupportedLanguage;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @MaxLength(200, { each: true })
  includedItems?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @MaxLength(200, { each: true })
  excludedItems?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cancellationPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  meetingPoint?: string;
}
