import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { RequestAdminUser } from '../guards/admin-role.guard';

/**
 * Injects the admin grant resolved by `AdminRoleGuard`.
 *
 * Only populated on routes carrying `@AdminRoles()`; undefined elsewhere.
 */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestAdminUser | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ adminUser?: RequestAdminUser }>();
    return request.adminUser;
  },
);
