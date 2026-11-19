import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsArray,
  IsBoolean,
  Min,
  Length,
} from 'class-validator';

/** All fields optional — PATCH semantics. See UpdateDriverDto for why not PartialType. */
export class UpdateRoomDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  @IsOptional()
  roomType?: string;

  @IsString()
  @IsOptional()
  @Length(1, 255)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxOccupancy?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  priceUsd?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price_per_night?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  amenities?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
