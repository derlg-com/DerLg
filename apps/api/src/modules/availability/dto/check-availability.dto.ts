import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AvailabilityItemDto {
  @IsInt()
  @Min(1)
  dayNumber!: number;

  @IsEnum(['PLACE', 'HOTEL', 'TRANSPORT', 'GUIDE', 'CUSTOM'])
  type!: 'PLACE' | 'HOTEL' | 'TRANSPORT' | 'GUIDE' | 'CUSTOM';

  @IsOptional()
  @IsUUID()
  refId?: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsBoolean()
  bookable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  extraPriceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  itemKey?: string;
}

export class CheckAvailabilityDto {
  /** First day of the journey, `YYYY-MM-DD`. */
  @IsDateString()
  startDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests!: number;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AvailabilityItemDto)
  items!: AvailabilityItemDto[];

  /** Excludes an existing booking's own rows so re-checking a hold succeeds. */
  @IsOptional()
  @IsUUID()
  excludeBookingId?: string;

  /** Prices the itinerary against this package's base price when provided. */
  @IsOptional()
  @IsUUID()
  packageId?: string;
}
