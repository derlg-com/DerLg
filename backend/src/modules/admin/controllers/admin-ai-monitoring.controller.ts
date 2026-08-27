import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AdminRoles } from '../../../common/decorators/admin-roles.decorator';
import { AdminAIMonitoringService } from '../services/admin-ai-monitoring.service';
import { AdminRole } from '@prisma/client';

@Controller('admin/ai-sessions')
@AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminAIMonitoringController {
  constructor(private readonly service: AdminAIMonitoringService) {}

  @Get('bookings')
  async getAIAssistedBookings(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const result = await this.service.getAIAssistedBookings({
      startDate,
      endDate,
    });
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get(':sessionId')
  async getAISessionDetails(@Param('sessionId') sessionId: string) {
    const result = await this.service.getAISessionDetails(sessionId);

    if (result === null) {
      throw new NotFoundException('Session not found');
    }

    if (result.expired) {
      return {
        success: false,
        data: null,
        message: 'Session expired',
        error: 'Session expired',
      };
    }

    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get('metrics/success-rate')
  async getAIBookingSuccessRate(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const result = await this.service.getAIBookingSuccessRate({
      startDate,
      endDate,
    });
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Get('metrics/performance')
  async getAIPerformanceMetrics(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const result = await this.service.getAIPerformanceMetrics({
      startDate,
      endDate,
    });
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }
}
