import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  ParseUUIDPipe,
  Body,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AdminRoles } from '../../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminUsersService } from '../services/admin-users.service';
import { AdminRole } from '@prisma/client';
import {
  CreateAdminUserDto,
  ResetAdminPasswordDto,
} from '../dto/create-admin-user.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';

@Controller('admin/users')
@AdminRoles(AdminRole.SUPER_ADMIN)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  async getAllAdminUsers() {
    const result = await this.service.getAllAdminUsers();
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get(':id')
  async getAdminUserById(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      data: await this.service.getAdminUserById(id),
      message: 'ok',
      error: null,
    };
  }

  @Post()
  async createAdminUser(
    @Body() dto: CreateAdminUserDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.createAdminUser(dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'ADMIN_USER',
      entityId: result.id,
      metadata: {
        action: 'CREATE_ADMIN_USER',
        email: result.email,
        adminRole: result.adminRole,
        // Never log the password itself, only whether one was set.
        passwordSet: result.canSignIn,
      },
    });

    return {
      success: true,
      data: result,
      message: result.canSignIn
        ? 'Admin user created successfully'
        : 'Admin user created but left INACTIVE: no password was supplied, so this ' +
          'account cannot sign in. Use POST /admin/users/:id/reset-password to set one.',
      error: null,
    };
  }

  /**
   * Sets a password and reactivates the grant.
   *
   * Also the remedy for an account created without a password, which is otherwise
   * unusable.
   */
  @Post(':id/reset-password')
  async resetAdminPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetAdminPasswordDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.resetAdminPassword(id, dto.password);

    await this.service.createAuditLog({
      userId,
      eventType: 'security_event',
      entityType: 'ADMIN_USER',
      entityId: id,
      metadata: {
        action: 'RESET_ADMIN_PASSWORD',
        targetUserId: result.userId,
        clearedSessionKeys: result.clearedSessionKeys,
      },
    });

    return {
      success: true,
      data: result,
      message: `Password reset; ${result.clearedSessionKeys} active session(s) terminated`,
      error: null,
    };
  }

  @Patch(':id')
  async updateAdminUser(
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.updateAdminUser(id, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'ADMIN_USER',
      entityId: id,
      metadata: {
        action: 'UPDATE_ADMIN_USER',
        fields: Object.keys(dto),
      },
    });

    return {
      success: true,
      data: result,
      message: 'Admin user updated successfully',
      error: null,
    };
  }

  @Patch(':id/deactivate')
  async deactivateAdminUser(
    @Param('id') id: string,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.deactivateAdminUser(id);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'ADMIN_USER',
      entityId: id,
      metadata: {
        action: 'DEACTIVATE_ADMIN_USER',
        userId: result.userId,
      },
    });

    return {
      success: true,
      data: result,
      message: 'Admin user deactivated successfully',
      error: null,
    };
  }
}
