import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsEnum,
  IsObject,
} from 'class-validator';
import { AdminRole } from '@prisma/client';

export class CreateAdminUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(AdminRole)
  @IsNotEmpty()
  adminRole: AdminRole;

  @IsObject()
  @IsOptional()
  permissions?: Record<string, boolean>;
}
