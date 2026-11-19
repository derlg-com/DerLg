import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsArray,
  IsEnum,
  IsBoolean,
  Min,
  Length,
} from 'class-validator';

import {
  VehicleType,
  PricingModel,
  VehicleTier,
  VehicleSubtype,
} from '@prisma/client';

/** All fields optional — PATCH semantics. See UpdateDriverDto for why not PartialType. */
export class UpdateVehicleDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  @IsOptional()
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

  // tier and subtype arrived in the vehicle_tier_subtype migration after the
  // standalone admin schema was introspected, so the old DTO had no way to set
  // them. Exposed here so the fleet screen can edit VIP/normal and body type.
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
  @IsOptional()
  capacity?: number;

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
  @IsOptional()
  province?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
