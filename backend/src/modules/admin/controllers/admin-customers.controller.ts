import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AdminRoles } from '../../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminCustomersService } from '../services/admin-customers.service';
import { AdminRole, UserStatus } from '@prisma/client';
import { AdjustLoyaltyDto } from '../dto/adjust-loyalty.dto';
import {
  UpdateCustomerDto,
  UpdateCustomerRoleDto,
  UpdateCustomerStatusDto,
} from '../dto/update-customer.dto';

@Controller('admin/customers')
@AdminRoles(
  AdminRole.SUPPORT_AGENT,
  AdminRole.OPERATIONS_MANAGER,
  AdminRole.SUPER_ADMIN,
)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminCustomersController {
  constructor(private readonly service: AdminCustomersService) {}

  @Get()
  async getAllCustomers(
    @Query('search') search?: string,
    @Query('status') status?: UserStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAllCustomers({ search, status, page, limit });
  }

  @Get(':id')
  async getCustomerById(@Param('id') id: string) {
    return this.service.getCustomerById(id);
  }

  @Get(':id/reviews')
  async getCustomerReviews(@Param('id') id: string) {
    const reviews = await this.service.getCustomerReviews(id);
    return {
      success: true,
      data: reviews,
      message: 'ok',
      error: null,
    };
  }

  @Patch(':id')
  async updateCustomer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.updateCustomer(id, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'USER',
      entityId: id,
      metadata: {
        action: 'UPDATE_CUSTOMER',
        // Field names only — the values can contain personal data, and audit
        // rows are widely readable.
        changedFields: Object.keys(dto),
      },
    });

    return {
      success: true,
      data: result,
      message: 'Customer updated successfully',
      error: null,
    };
  }

  /**
   * Suspend, deactivate or restore an account.
   *
   * Available to SUPPORT_AGENT because front-line staff are the ones who field
   * abuse reports; the reason is mandatory and audit-logged.
   */
  @Patch(':id/status')
  async setCustomerStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerStatusDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.setCustomerStatus(
      id,
      dto.status,
      dto.reason,
    );

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'USER',
      entityId: id,
      metadata: {
        action: 'SET_CUSTOMER_STATUS',
        previousStatus: result.previousStatus,
        newStatus: result.status,
        reason: result.reason,
        revokedTokenCount: result.revokedTokenCount,
        clearedSessionKeys: result.clearedSessionKeys,
      },
    });

    return {
      success: true,
      data: result,
      message:
        result.status === UserStatus.active
          ? 'Customer reactivated'
          : `Customer ${result.status}; ${result.clearedSessionKeys} active session(s) terminated`,
      error: null,
    };
  }

  /**
   * Change a non-admin role. SUPER_ADMIN only.
   *
   * Narrowed at method level rather than the class, which grants SUPPORT_AGENT
   * and OPERATIONS_MANAGER. Method-level `@AdminRoles` overrides the class
   * decorator, so this route is the exception among otherwise support-accessible
   * customer routes.
   */
  @Patch(':id/role')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  async setCustomerRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerRoleDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.setCustomerRole(id, dto.role, userId);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'USER',
      entityId: id,
      metadata: {
        action: 'SET_CUSTOMER_ROLE',
        previousRole: result.previousRole,
        newRole: result.role,
      },
    });

    return {
      success: true,
      data: result,
      message: `Role changed to ${result.role}`,
      error: null,
    };
  }
}

@Controller('admin/loyalty')
@AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminLoyaltyController {
  constructor(private readonly service: AdminCustomersService) {}

  @Post('adjust')
  async adjustLoyaltyPoints(
    @Body() dto: AdjustLoyaltyDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.adjustLoyaltyPoints(dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'USER',
      entityId: dto.userId,
      metadata: {
        action: 'ADJUST_LOYALTY',
        adjustment: dto.points,
        previousBalance: result.previousBalance,
        newBalance: result.newBalance,
        description: dto.description,
      },
    });

    return {
      success: true,
      data: result,
      message: 'Loyalty points adjusted successfully',
      error: null,
    };
  }
}
