import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsIn,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchTripsDto {
  @IsString() destination: string;
  @IsNumber() @Type(() => Number) duration_days: number;
  @IsNumber() @Type(() => Number) people_count: number;
  @IsNumber() @Type(() => Number) budget_usd: number;
}

export class SearchHotelsDto {
  @IsString() city: string;
  @IsDateString() check_in: string;
  @IsDateString() check_out: string;
  @IsOptional() @IsNumber() @Type(() => Number) price_range?: number;
}

export class SearchGuidesDto {
  @IsString() location: string;
  @IsString() language: string;
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
