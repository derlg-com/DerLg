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

  @IsEnum(VehicleType)
  @IsOptional()
  vehicleType?: VehicleType;

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

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsEnum(PricingModel)
  @IsOptional()
  pricingModel?: PricingModel;

  @IsNumber()
  @Min(0)
  @IsOptional()
  priceUsd?: number;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  province?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
