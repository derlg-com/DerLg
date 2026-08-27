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
import { AdminDiscountsService } from '../services/admin-discounts.service';
import { AdminRole } from '@prisma/client';
import { CreateDiscountCodeDto } from '../dto/create-discount.dto';
import { UpdateDiscountCodeDto } from '../dto/update-discount.dto';
import { ReviewStudentVerificationDto } from '../dto/review-student-verification.dto';

@Controller('admin/discounts')
@AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminDiscountsController {
  constructor(private readonly service: AdminDiscountsService) {}

  @Get()
  async getAllDiscountCodes(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.service.getAllDiscountCodes({ page, limit });
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Post()
  async createDiscountCode(
    @Body() dto: CreateDiscountCodeDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.createDiscountCode(dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'DISCOUNT_CODE',
      entityId: result.id,
      metadata: {
        action: 'CREATE_DISCOUNT_CODE',
        code: dto.code,
        discountType: dto.discountType,
        value: dto.value,
      },
    });

    return {
      success: true,
      data: result,
      message: 'Discount code created successfully',
      error: null,
    };
  }

  @Patch(':id')
  async updateDiscountCode(
    @Param('id') id: string,
    @Body() dto: UpdateDiscountCodeDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.updateDiscountCode(id, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'DISCOUNT_CODE',
      entityId: id,
      metadata: {
        action: 'UPDATE_DISCOUNT_CODE',
        fields: Object.keys(dto),
      },
    });

    return {
      success: true,
      data: result,
      message: 'Discount code updated successfully',
      error: null,
    };
  }

  @Patch(':id/deactivate')
  async deactivateDiscountCode(
    @Param('id') id: string,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.deactivateDiscountCode(id);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'DISCOUNT_CODE',
      entityId: id,
      metadata: {
        action: 'DEACTIVATE_DISCOUNT_CODE',
        code: result.code,
      },
    });

    return {
      success: true,
      data: result,
      message: 'Discount code deactivated successfully',
      error: null,
    };
  }
}

@Controller('admin/student-verifications')
@AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminStudentVerificationsController {
  constructor(private readonly service: AdminDiscountsService) {}

  @Get()
  async getAllStudentVerifications(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.service.getAllStudentVerifications({
      status,
      page,
      limit,
    });
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }

  @Patch(':id')
  async reviewStudentVerification(
    @Param('id') id: string,
    @Body() dto: ReviewStudentVerificationDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.reviewStudentVerification(
      id,
      dto,
      userId,
    );

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'STUDENT_VERIFICATION',
      entityId: id,
      metadata: {
        action: 'REVIEW_STUDENT_VERIFICATION',
        status: dto.status,
        reviewNotes: dto.reviewNotes,
        userId: result.userId,
      },
    });

    return {
      success: true,
      data: result,
      message: 'Student verification reviewed successfully',
      error: null,
    };
  }
}
