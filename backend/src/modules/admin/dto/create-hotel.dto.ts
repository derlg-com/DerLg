import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsArray,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  Length,
} from 'class-validator';
import { HotelType } from '@prisma/client';

export class CreateHotelDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  // Arrived in the add_hotel_type migration, after the standalone schema was
  // introspected.
  @IsEnum(HotelType)
  @IsOptional()
  type?: HotelType;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  starRating?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  star_rating?: number;

  @IsString()
  @IsOptional()
  check_in_time?: string;

  @IsString()
  @IsOptional()
  check_out_time?: string;

  @IsString()
  @IsOptional()
  cancellation_policy?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  amenities?: string[];

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
