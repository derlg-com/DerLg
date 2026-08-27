import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AdminRoles } from '../../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminEmergencyService } from '../services/admin-emergency.service';
import { AdminRole } from '@prisma/client';
import { UpdateEmergencyDto } from '../dto/update-emergency.dto';
import type { EmergencyDetailResponseDto } from '../dto/emergency-detail-response.dto';

@Controller('admin/emergency')
@AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminEmergencyController {
  constructor(private readonly service: AdminEmergencyService) {}

  @Get()
  async getAllEmergencyAlerts(
    @Query('status') status?: string,
    @Query('alert_type') alertType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAllEmergencyAlerts({
      status,
      alertType,
      page,
      limit,
    });
  }

  @Get(':id')
  async getEmergencyAlertById(@Param('id') id: string) {
    return this.service.getEmergencyAlertById(id);
  }

  @Patch(':id')
  async updateEmergencyAlert(
    @Param('id') id: string,
    @Body() dto: UpdateEmergencyDto,
    @CurrentUser('sub') userId?: string,
  ) {
    // Both branches return the same detail DTO; declaring the type keeps the
    // audit metadata below type-safe instead of reading `.status` off `any`.
    let alert: EmergencyDetailResponseDto;
    let action: string;

    if (dto.status === 'acknowledged') {
      alert = await this.service.acknowledgeAlert(id, userId);
      action = 'ACKNOWLEDGE_EMERGENCY';
    } else if (dto.status === 'resolved') {
      alert = await this.service.resolveAlert(id, dto.notes, userId);
      action = 'RESOLVE_EMERGENCY';
    } else {
      throw new Error(
        'Invalid status transition. Use "acknowledged" or "resolved"',
      );
    }

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'EMERGENCY',
      entityId: id,
      metadata: {
        action,
        newStatus: alert.status,
        notes: dto.notes,
      },
    });

    return {
      success: true,
      data: alert,
      message: 'ok',
      error: null,
    };
  }
}
