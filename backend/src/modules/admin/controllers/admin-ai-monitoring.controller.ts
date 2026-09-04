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
import { ListAiSessionsDto } from '../dto/list-ai-sessions.dto';

@Controller('admin/ai-sessions')
@AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminAIMonitoringController {
  constructor(private readonly service: AdminAIMonitoringService) {}

  /**
   * Paginated session list.
   *
   * Returns the service result directly so `TransformInterceptor` wraps it as
   * `{ success, data: { data, meta } }`, matching `admin/hotels` and
   * `admin/customers`. Hand-building an envelope with a sibling `meta` would put
   * it outside `data`, and the frontend's axios interceptor — which replaces the
   * body with `body.data` — would silently discard the pagination.
   */
  @Get()
  async listAISessions(@Query() query: ListAiSessionsDto) {
    return this.service.listAISessions({
      search: query.search,
      language: query.language,
      onlyGuests: query.onlyGuestsBool,
      page: query.page,
      limit: query.limit,
    });
  }

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

    // An expired Redis TTL is no longer an error. The archived transcript is
    // returned with `source: 'db'` and `expired: true` so the caller can label
    // it, rather than the old `success: false` that hid the conversation.
    return {
      success: true,
      data: result,
      message: result.expired ? 'Session archived (live state expired)' : 'ok',
      error: null,
    };
  }

  /**
   * The archived transcript, always read from Postgres.
   *
   * `GET :sessionId` prefers the live Redis copy; this one deliberately does not,
   * so an admin can see exactly what was persisted. Two path segments, so it
   * cannot be shadowed by the single-segment `:sessionId` route above.
   */
  @Get(':sessionId/transcript')
  async getAISessionTranscript(@Param('sessionId') sessionId: string) {
    const result = await this.service.getAISessionTranscript(sessionId);

    if (result === null) {
      throw new NotFoundException(`Session ${sessionId} not found`);
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
