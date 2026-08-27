import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsOptional,
  IsEnum,
  IsBoolean,
  Min,
  Length,
  IsDateString,
} from 'class-validator';

import { DiscountType, BookingType } from '@prisma/client';

/** All fields optional — PATCH semantics. See UpdateDriverDto for why not PartialType. */
export class UpdateDiscountCodeDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  @IsOptional()
  code?: string;

  @IsEnum(DiscountType)
  @IsOptional()
  discountType?: DiscountType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  value?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxUses?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minBookingUsd?: number;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validUntil?: string;

  @IsEnum(BookingType)
  @IsOptional()
  bookingType?: BookingType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
