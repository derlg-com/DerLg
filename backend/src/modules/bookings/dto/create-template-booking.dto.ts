import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingType } from '@prisma/client';

class TemplateItemDto {
  @IsEnum(BookingType)
  type!: BookingType;

  @IsUUID()
  resourceId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPriceUsd!: number;
}

export class CreateTemplateBookingDto {
  /**
   * UUID of the Trip template that seeded this itinerary, if any.
   * Populated for "private package" (M2) bookings; null/omitted for build-from-scratch (M3).
   */
  @IsOptional()
  @IsUUID()
  tripTemplateId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  items!: TemplateItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;
}
