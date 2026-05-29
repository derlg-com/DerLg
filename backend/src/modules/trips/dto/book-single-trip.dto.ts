import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class TravelersDto {
  @IsInt()
  @Min(1)
  adults!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;
}

export class BookSingleTripDto {
  @IsDateString()
  startDate!: string;

  @ValidateNested()
  @Type(() => TravelersDto)
  travelers!: TravelersDto;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;
}
