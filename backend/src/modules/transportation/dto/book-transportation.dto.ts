import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class BookTransportationDto {
  @IsUUID()
  vehicleId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  @MaxLength(500)
  pickupLocation!: string;

  @IsString()
  @MaxLength(500)
  dropoffLocation!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stops?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedDistanceKm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;
}
