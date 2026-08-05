import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * A booking is created either from a saved draft (the customize flow) or
 * straight from a package template (the "book as-is" button). Exactly one of
 * the two sources must be supplied.
 */
export class CreateBookingDto {
  @ValidateIf((dto: CreateBookingDto) => !dto.packageSlug && !dto.packageId)
  @IsUUID(undefined, { message: 'Provide either draftId or a package to book.' })
  draftId?: string;

  @IsOptional()
  @IsUUID()
  packageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  packageSlug?: string;

  /** Required when booking a package directly; a draft already carries its date. */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  guests?: number;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName!: string;

  @IsEmail()
  @MaxLength(254)
  contactEmail!: string;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
