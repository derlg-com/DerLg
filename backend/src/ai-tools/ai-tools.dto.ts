import { IsString, IsOptional, IsNumber, IsDateString, IsIn } from 'class-validator';
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

export class CheckAvailabilityDto {
  @IsString() @IsIn(['trip', 'hotel', 'guide']) item_type: string;
  @IsString() item_id: string;
  @IsDateString() date: string;
}

export class CreateBookingHoldDto {
  @IsString() user_id: string;
  @IsString() @IsIn(['trip', 'hotel', 'guide']) item_type: string;
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
