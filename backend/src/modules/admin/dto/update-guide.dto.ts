import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsBoolean,
  IsEnum,
  Min,
  Length,
} from 'class-validator';

import { SupportedLanguage, Specialty } from '@prisma/client';

/**
 * All fields optional — PATCH semantics. See UpdateDriverDto for why not PartialType.
 *
 * `languages` and `specialties` are enum-validated rather than free strings:
 * the guide_languages_specialties_packages migration replaced the old free-text
 * `speciality` column with the `Specialty` enum, so anything else is rejected at
 * the database level anyway. Validating here turns a 500 into a 400.
 */
export class UpdateGuideDto {
  @IsString()
  @IsOptional()
  bio?: string;

  @IsArray()
  @IsEnum(SupportedLanguage, { each: true })
  @IsOptional()
  languages?: SupportedLanguage[];

  @IsArray()
  @IsEnum(Specialty, { each: true })
  @IsOptional()
  specialties?: Specialty[];

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  @IsOptional()
  province?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  provinces?: string[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  pricePerDayUsd?: number;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsBoolean()
  @IsOptional()
  isVerified?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
