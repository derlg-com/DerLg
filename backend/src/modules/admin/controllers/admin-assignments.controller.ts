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
import { AdminAssignmentsService } from '../services/admin-assignments.service';
import { AdminRole } from '@prisma/client';
import { AssignDriverDto } from '../dto/assign-driver.dto';

@Controller('admin/assignments')
@AdminRoles(
  AdminRole.FLEET_MANAGER,
  AdminRole.OPERATIONS_MANAGER,
  AdminRole.SUPER_ADMIN,
)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminAssignmentsController {
  constructor(private readonly service: AdminAssignmentsService) {}

  @Get()
  async getAssignments(
    @Query('driver_id') driverId?: string,
    @Query('booking_id') bookingId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAssignments({ driverId, bookingId, page, limit });
  }

  @Post()
  async assignDriver(
    @Body() dto: AssignDriverDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const assignment = await this.service.assignDriver(dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'DRIVER_ASSIGNMENT',
      entityId: assignment.id,
      metadata: {
        action: 'ASSIGN_DRIVER',
        driverId: dto.driverId,
        bookingId: dto.bookingId,
        vehicleId: dto.vehicleId,
      },
    });

    return {
      success: true,
      data: assignment,
      message: 'ok',
      error: null,
    };
  }

  @Patch(':id/complete')
  async completeAssignment(
    @Param('id') id: string,
    @CurrentUser('sub') userId?: string,
  ) {
    const assignment = await this.service.completeAssignment(id);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'DRIVER_ASSIGNMENT',
      entityId: assignment.id,
      metadata: {
        action: 'COMPLETE_ASSIGNMENT',
        driverId: assignment.driverId,
        bookingId: assignment.bookingId,
      },
    });

    return {
      success: true,
      data: assignment,
      message: 'Assignment completed successfully',
      error: null,
    };
  }
}
