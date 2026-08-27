import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsBoolean,
  IsEnum,
  IsUUID,
  Min,
  Length,
} from 'class-validator';
import { SupportedLanguage, Specialty } from '@prisma/client';

export class CreateGuideDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsOptional()
  bio?: string;

  // Enum-validated: the guide_languages_specialties_packages migration replaced
  // free-text specialities with the Specialty enum, so free strings would fail
  // at the database level. Validating here turns a 500 into a 400.
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
  province: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  provinces?: string[];

  @IsNumber()
  @Min(0)
  pricePerDayUsd: number;

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
