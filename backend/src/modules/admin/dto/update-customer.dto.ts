import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SupportedLanguage, UserRole, UserStatus } from '@prisma/client';

/** Editable profile fields. Email is deliberately excluded — it is the login
 *  identity and changing it belongs in an account-recovery flow, not here. */
export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  /**
   * Not `@IsPhoneNumber`: DerLg serves inbound tourists whose numbers are in
   * arbitrary international formats, and a region-locked validator would reject
   * legitimate ones. Length-bounded instead.
   */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsEnum(SupportedLanguage)
  preferredLanguage?: SupportedLanguage;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  emergencyContactPhone?: string;
}

export class UpdateCustomerStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;

  /**
   * Required, and recorded in the audit log.
   *
   * Suspension locks a paying customer out of their bookings, so the reason has
   * to be recoverable later — "who did this and why" is the first question asked
   * when a customer disputes it.
   */
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

/**
 * Roles a super admin may assign through the customer screen.
 *
 * Deliberately excludes every admin role. Granting `admin`, `super_admin`,
 * `operations_manager`, `fleet_manager` or `support_agent` requires a matching
 * `admin_users` grant to mean anything, and that is what `/admin/users` exists
 * to create. Allowing them here would mint a user whose JWT claims an admin role
 * while `AdminRoleGuard` finds no grant — a confusing half-privileged account.
 */
export const ASSIGNABLE_CUSTOMER_ROLES = [
  UserRole.user,
  UserRole.guide,
  UserRole.student,
] as const;

export class UpdateCustomerRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}
