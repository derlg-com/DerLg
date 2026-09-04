import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  ParseUUIDPipe,
  Query,
  Body,
  UseInterceptors,
} from '@nestjs/common';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AdminRoles } from '../../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RateLimit } from '../../../common/throttler/rate-limit';
import { AdminVehiclesService } from '../services/admin-vehicles.service';
import { AdminRole } from '@prisma/client';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../dto/update-vehicle.dto';
import { ListVehiclesDto } from '../dto/list-fleet.dto';

@Controller('admin/vehicles')
@AdminRoles(
  AdminRole.FLEET_MANAGER,
  AdminRole.OPERATIONS_MANAGER,
  AdminRole.SUPER_ADMIN,
)
@RateLimit('ADMIN')
@UseInterceptors(AuditInterceptor)
export class AdminVehiclesController {
  constructor(private readonly service: AdminVehiclesService) {}

  @Get()
  async getAllVehicles(@Query() query: ListVehiclesDto) {
    return this.service.getAllVehicles({
      category: query.category,
      tier: query.tier,
      search: query.search,
      page: query.page?.toString(),
      limit: query.limit?.toString(),
    });
  }

  @Get(':id')
  async getVehicleById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getVehicleById(id);
  }

  @Get(':id/availability')
  async getVehicleAvailability(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getVehicleAvailability(id);
  }

  @Post()
  async createVehicle(
    @Body() dto: CreateVehicleDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const vehicle = await this.service.createVehicle(dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'VEHICLE',
      entityId: vehicle.id,
      metadata: {
        action: 'CREATE_VEHICLE',
        name: vehicle.name,
        vehicleType: vehicle.vehicleType,
      },
    });

    return {
      success: true,
      data: vehicle,
      message: 'ok',
      error: null,
    };
  }

  @Patch(':id')
  async updateVehicle(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const vehicle = await this.service.updateVehicle(id, dto, userId);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'VEHICLE',
      entityId: vehicle.id,
      metadata: {
        action: 'UPDATE_VEHICLE',
        changedFields: Object.keys(dto),
      },
    });

    return {
      success: true,
      data: vehicle,
      message: 'ok',
      error: null,
    };
  }

  /**
   * Retires a vehicle.
   *
   * Mirrors `PATCH /admin/drivers/:id/deactivate`. The admin panel's vehicle
   * list had a Delete button wired to `DELETE /admin/vehicles/:id`, which no
   * handler served — the request 404'd and the row never changed. A hard delete
   * is not the right operation anyway: historical bookings reference the vehicle.
   */
  @Patch(':id/deactivate')
  async deactivateVehicle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId?: string,
  ) {
    const vehicle = await this.service.deactivateVehicle(id);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'VEHICLE',
      entityId: vehicle.id,
      metadata: {
        action: 'DEACTIVATE_VEHICLE',
        name: vehicle.name,
      },
    });

    return {
      success: true,
      data: vehicle,
      message: 'Vehicle deactivated successfully',
      error: null,
    };
  }
}
