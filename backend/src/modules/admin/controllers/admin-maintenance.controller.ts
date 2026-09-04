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
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AdminRoles } from '../../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RateLimit } from '../../../common/throttler/rate-limit';
import { AdminMaintenanceService } from '../services/admin-maintenance.service';
import { AdminRole } from '@prisma/client';
import { ScheduleMaintenanceDto } from '../dto/schedule-maintenance.dto';
import { UpdateMaintenanceDto } from '../dto/update-maintenance.dto';
import { ListMaintenanceDto } from '../dto/list-fleet.dto';

@Controller('admin/maintenance')
@AdminRoles(
  AdminRole.FLEET_MANAGER,
  AdminRole.OPERATIONS_MANAGER,
  AdminRole.SUPER_ADMIN,
)
@RateLimit('ADMIN')
@UseInterceptors(AuditInterceptor)
export class AdminMaintenanceController {
  constructor(private readonly service: AdminMaintenanceService) {}

  @Get()
  async getMaintenanceSchedule(@Query() query: ListMaintenanceDto) {
    return this.service.getMaintenanceSchedule({
      vehicleId: query.vehicle_id,
      status: query.status,
      startDate: query.start_date,
      endDate: query.end_date,
      page: query.page?.toString(),
      limit: query.limit?.toString(),
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
