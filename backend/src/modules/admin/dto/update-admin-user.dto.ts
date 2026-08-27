import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsBoolean,
} from 'class-validator';

import { AdminRole } from '@prisma/client';

/**
 * All fields optional — PATCH semantics. See UpdateDriverDto for why not PartialType.
 *
 * `email` is deliberately absent: it is the login identity and the unique key
 * used to find the account, so changing it belongs in the account-management
 * flow rather than in an admin-role edit.
 */
export class UpdateAdminUserDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(AdminRole)
  @IsOptional()
  adminRole?: AdminRole;

  @IsObject()
  @IsOptional()
  permissions?: Record<string, boolean>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
