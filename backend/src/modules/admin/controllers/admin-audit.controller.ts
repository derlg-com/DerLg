import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AdminRoles } from '../../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminAuditService } from '../services/admin-audit.service';
import { AdminRole } from '@prisma/client';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

@Controller('admin/audit-logs')
@AdminRoles(AdminRole.SUPER_ADMIN)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminAuditController {
  constructor(private readonly service: AdminAuditService) {}

  @Get()
  async getAllAuditLogs(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('admin_user_id') adminUserId?: string,
    @Query('action_type') actionType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.service.getAllAuditLogs({
      startDate,
      endDate,
      adminUserId,
      actionType,
      page,
      limit,
    });
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Post()
  async createAuditLog(
    @Body() dto: CreateAuditLogDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.createAuditLog({
      userId,
      eventType: dto.eventType,
      entityType: dto.entityType,
      entityId: dto.entityId,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
      metadata: dto.metadata,
    });

    return {
      success: true,
      data: result,
      message: 'Audit log entry created successfully',
      error: null,
    };
  }

  @Get('export')
  async exportAuditLogs(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('admin_user_id') adminUserId?: string,
    @Query('action_type') actionType?: string,
  ) {
    const result = await this.service.exportAuditLogs({
      startDate,
      endDate,
      adminUserId,
      actionType,
    });

    return {
      success: true,
      data: result,
      message: 'Audit logs exported successfully',
      error: null,
    };
  }
}
