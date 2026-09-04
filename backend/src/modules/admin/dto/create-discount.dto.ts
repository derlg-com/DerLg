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

export class CreateDiscountCodeDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  code: string;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsNumber()
  @Min(0)
  value: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxUses?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minBookingUsd?: number;

  @IsDateString()
  validFrom: string;

  @IsDateString()
  validUntil: string;

  @IsEnum(BookingType)
  @IsOptional()
  bookingType?: BookingType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
