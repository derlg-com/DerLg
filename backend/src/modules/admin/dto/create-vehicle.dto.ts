import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsArray,
  IsEnum,
  Min,
  Length,
} from 'class-validator';
import {
  VehicleType,
  PricingModel,
  VehicleTier,
  VehicleSubtype,
} from '@prisma/client';

export class CreateVehicleDto {
  @IsString()
  @IsOptional()
  @Length(1, 255)
  name?: string;

  @IsString()
  @IsOptional()
  make?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsInt()
  @IsOptional()
  year?: number;

  @IsEnum(VehicleType)
  @IsOptional()
  vehicleType?: VehicleType;

  @IsEnum(VehicleType)
  @IsOptional()
  vehicle_type?: VehicleType;

  // Added post-introspection by the vehicle_tier_subtype migration.
  @IsEnum(VehicleTier)
  @IsOptional()
  tier?: VehicleTier;

  @IsEnum(VehicleSubtype)
  @IsOptional()
  subtype?: VehicleSubtype;

  @IsString()
  @IsOptional()
  licensePlate?: string;

  @IsString()
  @IsOptional()
  license_plate?: string;

  @IsString()
  @IsOptional()
  plateNumber?: string;

  @IsString()
  @IsOptional()
  plate_number?: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsEnum(PricingModel)
  @IsOptional()
  pricingModel?: PricingModel;

  @IsEnum(PricingModel)
  @IsOptional()
  pricing_model?: PricingModel;

  @IsNumber()
  @Min(0)
  @IsOptional()
  priceUsd?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price_usd?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  pricePerDayUsd?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price_per_day_usd?: number;

  @IsString()
  @IsNotEmpty()
  province: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}
