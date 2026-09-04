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
import { AdminGuidesService } from '../services/admin-guides.service';
import { AdminRole } from '@prisma/client';
import { CreateGuideDto } from '../dto/create-guide.dto';
import { UpdateGuideDto } from '../dto/update-guide.dto';

@Controller('admin/guides')
@AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminGuidesController {
  constructor(private readonly service: AdminGuidesService) {}

  @Get()
  async getAllGuides(
    @Query('languages') languages?: string,
    @Query('specialties') specialties?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAllGuides({
      languages,
      specialties,
      search,
      page,
      limit,
    });
  }

  @Get(':id')
  async getGuideById(@Param('id') id: string) {
    return this.service.getGuideById(id);
  }

  @Post()
  async createGuide(
    @Body() dto: CreateGuideDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const guide = await this.service.createGuide(dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'GUIDE',
      entityId: guide.id,
      metadata: {
        action: 'CREATE_GUIDE',
        userId: guide.userId,
        province: guide.province,
      },
    });

    return {
      success: true,
      data: guide,
      message: 'ok',
      error: null,
    };
  }

  @Patch(':id')
  async updateGuide(
    @Param('id') id: string,
    @Body() dto: UpdateGuideDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const guide = await this.service.updateGuide(id, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'GUIDE',
      entityId: id,
      metadata: {
        action: 'UPDATE_GUIDE',
        changedFields: Object.keys(dto),
      },
    });

    return {
      success: true,
      data: guide,
      message: 'ok',
      error: null,
    };
  }

  @Get(':id/assignments')
  async getGuideAssignments(@Param('id') id: string) {
    const assignments = await this.service.getGuideAssignments(id);
    return {
      success: true,
      data: assignments,
      message: 'ok',
      error: null,
    };
  }

  @Get(':id/availability')
  async getGuideAvailability(
    @Param('id') id: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    if (!startDate || !endDate) {
      return {
        success: false,
        data: null,
        message: 'start_date and end_date are required',
        error: 'Missing required query parameters',
      };
    }

    const result = await this.service.getGuideAvailability(
      id,
      startDate,
      endDate,
    );
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }
}
