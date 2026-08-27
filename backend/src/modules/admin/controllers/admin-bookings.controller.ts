import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AdminRoles } from '../../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminBookingsService } from '../services/admin-bookings.service';
import { AdminRole } from '@prisma/client';
import { UpdateBookingDto } from '../dto/update-booking.dto';

@Controller('admin/bookings')
@AdminRoles(
  AdminRole.SUPPORT_AGENT,
  AdminRole.OPERATIONS_MANAGER,
  AdminRole.SUPER_ADMIN,
)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminBookingsController {
  constructor(private readonly service: AdminBookingsService) {}

  @Get()
  async getAllBookings(
    @Query('booking_type') bookingType?: string,
    @Query('status') status?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAllBookings({
      bookingType,
      status,
      startDate,
      endDate,
      search,
      page,
      limit,
    });
  }

  @Get('unassigned')
  async getUnassignedBookings(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getUnassignedBookings({ page, limit });
  }

  @Get(':id')
  async getBookingById(@Param('id') id: string) {
    return this.service.getBookingById(id);
  }

  @Patch(':id')
  async updateBooking(
    @Param('id') id: string,
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

  @Post(':id/cancel')
  async cancelBooking(
    @Param('id') id: string,
    @Body('cancel_reason') cancelReason?: string,
    @CurrentUser('sub') userId?: string,
  ) {
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
