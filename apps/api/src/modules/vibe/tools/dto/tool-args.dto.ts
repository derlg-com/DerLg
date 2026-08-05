import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
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

/**
 * Argument shapes for the tools the model may call.
 *
 * Every numeric field carries `@Type(() => Number)` on purpose: llama-3.1 on
 * NVIDIA NIM emits numbers as JSON strings ("60" rather than 60), so validation
 * must coerce rather than reject. Verified live in Task 13.
 *
 * Anything the model sends that is not declared here is stripped by the
 * ValidationPipe's whitelist behaviour, so a hallucinated parameter cannot reach
 * a service.
 */

export class SearchPlacesArgsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsEnum(['TEMPLE', 'MUSEUM', 'MARKET', 'NATURE', 'LANDMARK', 'ENTERTAINMENT', 'FOOD'])
  category?: 'TEMPLE' | 'MUSEUM' | 'MARKET' | 'NATURE' | 'LANDMARK' | 'ENTERTAINMENT' | 'FOOD';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  query?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class SearchHotelsArgsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  maxPricePerNightUsd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minStars?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class SearchTransportArgsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  fromCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  toCity?: string;

  @IsOptional()
  @IsEnum(['VAN', 'BUS', 'TUKTUK', 'PRIVATE_CAR'])
  kind?: 'VAN' | 'BUS' | 'TUKTUK' | 'PRIVATE_CAR';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  maxPricePerSeatUsd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class SearchGuidesArgsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  language?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  maxPricePerDayUsd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class CheckAvailabilityItemArgsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  dayNumber!: number;

  @IsEnum(['PLACE', 'HOTEL', 'TRANSPORT', 'GUIDE'])
  type!: 'PLACE' | 'HOTEL' | 'TRANSPORT' | 'GUIDE';

  @IsUUID()
  refId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

export class CheckAvailabilityArgsDto {
  @IsDateString()
  startDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  guests!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckAvailabilityItemArgsDto)
  items!: CheckAvailabilityItemArgsDto[];
}

export class ListPackagesArgsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  maxDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  maxTotalUsd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}
