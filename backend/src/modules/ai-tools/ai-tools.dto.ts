import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsIn,
  IsUUID,
  IsArray,
  IsInt,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  SupportedLanguage,
  HotelType,
  VehicleTier,
  VehicleSubtype,
} from '@prisma/client';

export class SearchTripsDto {
  @IsString() destination: string;
  @IsOptional() @IsNumber() @Type(() => Number) duration_days?: number;
  @IsOptional() @IsNumber() @Type(() => Number) people_count?: number;
  @IsOptional() @IsNumber() @Type(() => Number) budget_usd?: number;
}

export class SearchHotelsDto {
  @IsString() city: string;
  @IsOptional() @IsDateString() check_in?: string;
  @IsOptional() @IsDateString() check_out?: string;
  @IsOptional() @IsNumber() @Type(() => Number) price_range?: number;
  @IsOptional() @IsIn(Object.values(HotelType)) type?: HotelType;
}

export class SearchGuidesDto {
  @IsString() location: string;
  @IsIn(Object.values(SupportedLanguage)) language: string;
  @IsDateString() date: string;
}

export class SearchTransportDto {
  @IsString() from_location: string;
  @IsString() to_location: string;
  @IsDateString() departure_date: string;
  @IsOptional() @IsNumber() @Type(() => Number) people_count?: number;
  @IsOptional()
  @IsString()
  @IsIn(['van', 'bus', 'tuk_tuk', 'taxi', 'shuttle', 'minivan'])
  mode?: string;
  @IsOptional() @IsIn(Object.values(VehicleTier)) tier?: VehicleTier;
  @IsOptional() @IsIn(Object.values(VehicleSubtype)) subtype?: VehicleSubtype;
}

export class CreateCustomTripExtraDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNumber()
  @Min(0.01)
  unit_price_usd: number;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}

export class CreateCustomTripDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  duration_days: number;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsUUID()
  hotel_room_id?: string;

  @IsOptional()
  @IsUUID()
  guide_id?: string;

  @IsOptional()
  @IsUUID()
  vehicle_id?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCustomTripExtraDto)
  extras?: CreateCustomTripExtraDto[];
}

export class CheckAvailabilityDto {
  @IsString() @IsIn(['trip', 'hotel', 'guide', 'transport']) item_type: string;
  @IsString() item_id: string;
  @IsDateString() date: string;
}

export class CreateBookingHoldDto {
  @IsString() user_id: string;
  @IsString() @IsIn(['trip', 'hotel', 'guide', 'transport']) item_type: string;
  @IsString() item_id: string;
  @IsDateString() travel_date: string;
  @IsNumber() @Type(() => Number) people_count: number;
}

export class GetWeatherDto {
  @IsString() location: string;
  @IsDateString() date: string;
}

export class GetEmergencyContactsDto {
  @IsString() location: string;
}

export class SendSosAlertDto {
  @IsString() user_id: string;
  @IsString() location: string;
  @IsString() message: string;
}

export class GetUserLoyaltyDto {
  @IsString() user_id: string;
}

export class CheckPaymentStatusDto {
  @IsString() booking_id: string;
}

export class GeneratePaymentQrDto {
  @IsString() booking_id: string;
  @IsString() @IsIn(['BAKONG', 'ABA', 'bakong', 'aba']) provider: string;
}

export class EstimateBudgetDto {
  @IsString() query: string;
  @IsString() @IsIn(['en', 'zh', 'km']) locale: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() @Type(() => Number) duration_days?: number;
  @IsOptional() @IsNumber() @Type(() => Number) people_count?: number;
}

export class GetPlacesDto {
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() @Type(() => Number) limit?: number;
}

export class GetFestivalsDto {
  @IsOptional() @IsString() month?: string;
  @IsOptional() @IsString() province?: string;
}
