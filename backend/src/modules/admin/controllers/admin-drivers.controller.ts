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
import { AdminDriversService } from '../services/admin-drivers.service';
import { AdminRole } from '@prisma/client';
import { CreateDriverDto } from '../dto/create-driver.dto';
import { UpdateDriverDto } from '../dto/update-driver.dto';
import { ListDriversDto } from '../dto/list-fleet.dto';

@Controller('admin/drivers')
@AdminRoles(
  AdminRole.FLEET_MANAGER,
  AdminRole.OPERATIONS_MANAGER,
  AdminRole.SUPER_ADMIN,
)
@RateLimit('ADMIN')
@UseInterceptors(AuditInterceptor)
export class AdminDriversController {
  constructor(private readonly service: AdminDriversService) {}

  @Get()
  async getAllDrivers(@Query() query: ListDriversDto) {
    return this.service.getAllDrivers({
      status: query.status,
      search: query.search,
      hasTelegram: query.hasTelegramBool,
      page: query.page?.toString(),
      limit: query.limit?.toString(),
    });
  }

  @Get(':id')
  async getDriverById(@Param('id') id: string) {
    return this.service.getDriverById(id);
  }

  @Post()
  async createDriver(
    @Body() dto: CreateDriverDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const driver = await this.service.createDriver(dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'DRIVER',
      entityId: driver.id,
      metadata: {
        action: 'CREATE_DRIVER',
        driverId: driver.driverId,
        driverName: driver.driverName,
        telegramId: driver.telegramId?.toString(),
      },
    });

    return {
      success: true,
      data: driver,
      message: 'ok',
      error: null,
    };
  }

  @Patch(':id')
  async updateDriver(
    @Param('id') id: string,
    @Body() dto: UpdateDriverDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const driver = await this.service.updateDriver(id, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'DRIVER',
      entityId: driver.id,
      metadata: {
        action: 'UPDATE_DRIVER',
        changedFields: Object.keys(dto),
        newStatus: dto.status,
      },
    });

    return {
      success: true,
      data: driver,
      message: 'ok',
      error: null,
    };
  }

  @Patch(':id/deactivate')
  async deactivateDriver(
    @Param('id') id: string,
    @CurrentUser('sub') userId?: string,
  ) {
    const driver = await this.service.deactivateDriver(id);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'DRIVER',
      entityId: driver.id,
      metadata: {
        action: 'DEACTIVATE_DRIVER',
        previousStatus: driver.status,
        newStatus: 'OFFLINE',
      },
    });

    return {
      success: true,
      data: driver,
      message: 'Driver deactivated successfully',
      error: null,
    };
  }
}
