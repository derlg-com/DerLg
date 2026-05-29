import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Fields a user can update on a HOLD booking. All optional; the use case
 * rejects requests with no fields present and re-runs the overlap check
 * if dates change.
 */
export class UpdateBookingDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  guestsAdults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  guestsChildren?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;
}
