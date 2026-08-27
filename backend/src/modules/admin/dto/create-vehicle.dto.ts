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
  @IsNotEmpty()
  @Length(1, 255)
  name: string;

  @IsEnum(VehicleType)
  vehicleType: VehicleType;

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

  @IsInt()
  @Min(1)
  capacity: number;

  @IsEnum(PricingModel)
  pricingModel: PricingModel;

  @IsNumber()
  @Min(0)
  priceUsd: number;

  @IsString()
  @IsNotEmpty()
  province: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}
