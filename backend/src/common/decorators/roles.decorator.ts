import { SetMetadata } from '@nestjs/common';

/** Metadata key used by RolesGuard to read required roles. */
export const ROLES_KEY = 'roles';

/** Restricts a route or controller to the specified roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
