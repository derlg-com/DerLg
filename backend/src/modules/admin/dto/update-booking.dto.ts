import {
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  IsString,
  IsEnum,
} from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class UpdateBookingDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  passengerCount?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  roomCount?: number;

  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @IsString()
  @IsOptional()
  cancelReason?: string;
}
