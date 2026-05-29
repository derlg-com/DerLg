import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class BookGuideDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsUUID()
  linkedTripBookingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;
}
