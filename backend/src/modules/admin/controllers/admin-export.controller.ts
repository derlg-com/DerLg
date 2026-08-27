import { Controller, Get, Post, Query, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AdminRoles } from '../../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminExportService } from '../services/admin-export.service';
import { AdminRole } from '@prisma/client';

@Controller('admin')
@AdminRoles(AdminRole.SUPER_ADMIN)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminExportController {
  constructor(private readonly service: AdminExportService) {}

  @Get('export/bookings')
  async exportBookings(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('format') format?: string,
  ) {
    const result = await this.service.exportBookings({
      startDate,
      endDate,
      format,
    });
    return {
      success: true,
      data: result,
      message: 'Bookings exported successfully',
      error: null,
    };
  }

  @Get('export/drivers')
  async exportDrivers() {
    const result = await this.service.exportDrivers();
    return {
      success: true,
      data: result,
      message: 'Drivers exported successfully',
      error: null,
    };
  }

  @Get('export/payments')
  async exportPayments() {
    const result = await this.service.exportPayments();
    return {
      success: true,
      data: result,
      message: 'Payments exported successfully',
      error: null,
    };
  }

  @Post('backup')
  async triggerBackup(@CurrentUser('sub') userId?: string) {
    const result = await this.service.triggerBackup(userId || 'system');
    return {
      success: true,
      data: result,
      message: 'Backup triggered successfully',
      error: null,
    };
  }

  @Get('backups')
  async getBackups() {
    const result = await this.service.getBackups();
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }
}
