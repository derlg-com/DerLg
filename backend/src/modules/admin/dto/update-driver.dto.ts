import {
  IsEnum,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsUUID,
  Length,
  ValidateIf,
} from 'class-validator';

import { DriverStatus } from '@prisma/client';

/**
 * All fields optional — PATCH semantics.
 *
 * Written out explicitly rather than derived with `PartialType(CreateDriverDto)`.
 * `@nestjs/mapped-types` declares a peer dependency on class-validator
 * ^0.13 || ^0.14 and this project is on 0.15, so installing it would require
 * forcing a knowingly-wrong resolution. Being explicit also satisfies the
 * project rule that every DTO property carries its own validators, which
 * PartialType hides behind a factory.
 */
export class UpdateDriverDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  @IsOptional()
  driverName?: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  @IsOptional()
  driverId?: string;

  @IsString()
  @IsOptional()
  telegramId?: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  @IsOptional()
  phone?: string;

  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsUUID()
  @IsOptional()
  vehicleId?: string | null;

  @IsEnum(DriverStatus)
  @IsOptional()
  status?: DriverStatus;
}
