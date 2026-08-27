import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminRole } from '@prisma/client';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AdminRoles } from '../../../common/decorators/admin-roles.decorator';
import { CurrentAdmin } from '../../../common/decorators/current-admin.decorator';
import { AdminDashboardService } from '../services/admin-dashboard.service';

import type { RequestAdminUser } from '../../../common/guards/admin-role.guard';

/**
 * Dashboard overview.
 *
 * All four roles are listed explicitly rather than leaving `@AdminRoles()` off.
 * Omitting it makes `AdminRoleGuard` pass the route straight through, so the
 * dashboard — booking volume, revenue and live emergency alerts — was reachable
 * by any authenticated user, including ordinary customers. The decorator is what
 * activates the `admin_users` check.
 */
@Controller('admin/dashboard')
@AdminRoles(
  AdminRole.SUPPORT_AGENT,
  AdminRole.FLEET_MANAGER,
  AdminRole.OPERATIONS_MANAGER,
  AdminRole.SUPER_ADMIN,
)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminDashboardController {
  constructor(private readonly service: AdminDashboardService) {}

  @Get()
  async getDashboard(@CurrentAdmin() admin?: RequestAdminUser) {
    // Resolved by AdminRoleGuard, so it is always present on this route; the
    // service tailors which panels it returns to the caller's role.
    const result = await this.service.getDashboardOverview(admin?.adminRole);
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }
}
