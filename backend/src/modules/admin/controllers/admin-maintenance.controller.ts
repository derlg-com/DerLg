import {
  Controller,
  Get,
  Post,
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
import { AdminMaintenanceService } from '../services/admin-maintenance.service';
import { AdminRole } from '@prisma/client';
import { ScheduleMaintenanceDto } from '../dto/schedule-maintenance.dto';
import { UpdateMaintenanceDto } from '../dto/update-maintenance.dto';

@Controller('admin/maintenance')
@AdminRoles(
  AdminRole.FLEET_MANAGER,
  AdminRole.OPERATIONS_MANAGER,
  AdminRole.SUPER_ADMIN,
)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminMaintenanceController {
  constructor(private readonly service: AdminMaintenanceService) {}

  @Get()
  async getMaintenanceSchedule(
    @Query('vehicle_id') vehicleId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getMaintenanceSchedule({
      vehicleId,
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Get('upcoming')
  async getUpcomingMaintenance() {
    const data = await this.service.getUpcomingMaintenance();
    return {
      success: true,
      data,
      message: 'ok',
      error: null,
    };
  }

  @Get('vehicle/:vehicleId')
  async getMaintenanceHistory(@Param('vehicleId') vehicleId: string) {
    const data = await this.service.getMaintenanceHistory(vehicleId);
    return {
      success: true,
      data,
      message: 'ok',
      error: null,
    };
  }

  @Post()
  async scheduleMaintenance(
    @Body() dto: ScheduleMaintenanceDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const maintenance = await this.service.scheduleMaintenance(dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'VEHICLE_MAINTENANCE',
      entityId: maintenance.id,
      metadata: {
        action: 'SCHEDULE_MAINTENANCE',
        vehicleId: dto.vehicleId,
        maintenanceType: dto.maintenanceType,
        scheduledDate: dto.scheduledDate,
      },
    });

    return {
      success: true,
      data: maintenance,
      message: 'ok',
      error: null,
    };
  }

  @Patch(':id')
  async updateMaintenanceStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const maintenance = await this.service.updateMaintenanceStatus(id, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'VEHICLE_MAINTENANCE',
      entityId: maintenance.id,
      metadata: {
        action: 'UPDATE_MAINTENANCE_STATUS',
        newStatus: dto.status,
        completionDate: dto.completionDate,
        maintenanceCost: dto.maintenanceCost,
      },
    });

    return {
      success: true,
      data: maintenance,
      message: 'ok',
      error: null,
    };
  }
}
