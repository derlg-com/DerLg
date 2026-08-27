import { SetMetadata } from '@nestjs/common';

import type { AdminRole } from '@prisma/client';

/** Metadata key read by AdminRoleGuard to resolve the required admin roles. */
export const ADMIN_ROLES_KEY = 'adminRoles';

/**
 * Restricts a route or controller to holders of the given `admin_users.admin_role`.
 *
 * This is a second, finer-grained layer on top of `@Roles()`. `@Roles()` checks
 * the coarse `users.role` claim carried in the JWT; this checks the admin grant
 * stored in the database, so revoking someone's admin rights takes effect
 * without waiting for their 15-minute access token to expire.
 *
 * `SUPER_ADMIN` satisfies every requirement and does not need listing.
 */
export const AdminRoles = (...roles: AdminRole[]) =>
  SetMetadata(ADMIN_ROLES_KEY, roles);
