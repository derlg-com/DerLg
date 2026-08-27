import {
  Controller,
  Get,
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
import { AdminCustomersService } from '../services/admin-customers.service';
import { AdminRole } from '@prisma/client';
import { AdjustLoyaltyDto } from '../dto/adjust-loyalty.dto';

@Controller('admin/customers')
@AdminRoles(
  AdminRole.SUPPORT_AGENT,
  AdminRole.OPERATIONS_MANAGER,
  AdminRole.SUPER_ADMIN,
)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminCustomersController {
  constructor(private readonly service: AdminCustomersService) {}

  @Get()
  async getAllCustomers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAllCustomers({ search, page, limit });
  }

  @Get(':id')
  async getCustomerById(@Param('id') id: string) {
    return this.service.getCustomerById(id);
  }

  @Get(':id/reviews')
  async getCustomerReviews(@Param('id') id: string) {
    const reviews = await this.service.getCustomerReviews(id);
    return {
      success: true,
      data: reviews,
      message: 'ok',
      error: null,
    };
  }
}

@Controller('admin/loyalty')
@AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminLoyaltyController {
  constructor(private readonly service: AdminCustomersService) {}

  @Post('adjust')
  async adjustLoyaltyPoints(
    @Body() dto: AdjustLoyaltyDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.adjustLoyaltyPoints(dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'USER',
      entityId: dto.userId,
      metadata: {
        action: 'ADJUST_LOYALTY',
        adjustment: dto.points,
        previousBalance: result.previousBalance,
        newBalance: result.newBalance,
        description: dto.description,
      },
    });

    return {
      success: true,
      data: result,
      message: 'Loyalty points adjusted successfully',
      error: null,
    };
  }
}
