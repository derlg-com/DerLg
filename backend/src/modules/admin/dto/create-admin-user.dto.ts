import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsEnum,
  IsObject,
  MinLength,
  MaxLength,
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

  /**
   * Initial sign-in password.
   *
   * Optional, but omitting it produces an account that cannot log in: sign-in
   * checks `users.password_hash` and this endpoint previously never set one, so
   * every admin created through the panel was locked out from the moment it was
   * made. When omitted the grant is now created inactive and the response says so
   * explicitly, rather than silently handing back an unusable account.
   */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}

export class ResetAdminPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
