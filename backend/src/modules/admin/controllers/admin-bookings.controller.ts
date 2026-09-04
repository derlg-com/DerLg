import {
  Controller,
  Get,
  Patch,
  Post,
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
import { AdminBookingsService } from '../services/admin-bookings.service';
import { AdminRole } from '@prisma/client';
import { UpdateBookingDto } from '../dto/update-booking.dto';
import { AdminCancelBookingDto } from '../dto/admin-cancel-booking.dto';
import { ListAdminBookingsDto } from '../dto/list-fleet.dto';

@Controller('admin/bookings')
@AdminRoles(
  AdminRole.SUPPORT_AGENT,
  AdminRole.OPERATIONS_MANAGER,
  AdminRole.SUPER_ADMIN,
)
@RateLimit('ADMIN')
@UseInterceptors(AuditInterceptor)
export class AdminBookingsController {
  constructor(private readonly service: AdminBookingsService) {}

  @Get()
  async getAllBookings(@Query() query: ListAdminBookingsDto) {
    return this.service.getAllBookings({
      bookingType: query.booking_type,
      status: query.status,
      startDate: query.start_date,
      endDate: query.end_date,
      search: query.search,
      aiAssisted: query.aiAssistedBool,
      guideId: query.guide_id,
      page: query.page?.toString(),
      limit: query.limit?.toString(),
    });
  }

  @Get('unassigned')
  async getUnassignedBookings(@Query() query: ListAdminBookingsDto) {
    return this.service.getUnassignedBookings({
      page: query.page?.toString(),
      limit: query.limit?.toString(),
    });
  }

  @Get(':id')
  async getBookingById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getBookingById(id);
  }

  @Patch(':id')
  async updateBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const booking = await this.service.updateBooking(id, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'BOOKING',
      entityId: id,
      metadata: {
        action: 'UPDATE_BOOKING',
        changedFields: Object.keys(dto),
      },
    });

    return {
      success: true,
      data: booking,
      message: 'ok',
      error: null,
    };
  }

  /**
   * Admin-initiated cancellation.
   *
   * Distinct from `POST /v1/bookings/:id/cancel`, which enforces
   * `booking.userId === caller.sub` and therefore 403s for every admin acting on
   * a customer's booking. The admin panel was calling that customer route, so
   * cancellation was impossible from the panel and produced no audit trail.
   */
  @Post(':id/cancel')
  async cancelBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminCancelBookingDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const cancelReason = dto.resolvedReason;
    const existing = await this.service.getBookingById(id);
    const previousStatus = existing.status;
    const booking = await this.service.cancelBooking(id, cancelReason);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'BOOKING',
      entityId: id,
      metadata: {
        action: 'CANCEL_BOOKING',
        previousStatus,
        cancelReason,
      },
    });

    return {
      success: true,
      data: booking,
      message: 'Booking cancelled successfully',
      error: null,
    };
  }
}
