import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { Throttle } from '@nestjs/throttler';
import { AdminRole } from '@prisma/client';

import { AdminRoles } from '../../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminTelegramService } from '../services/admin-telegram.service';
import { TelegramService } from '../../telegram/telegram.service';
import { AdminBroadcastDto } from '../dto/admin-broadcast.dto';
import {
  AssignSupportTicketDto,
  UpdateSupportTicketDto,
} from '../dto/update-support-ticket.dto';

import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

/**
 * Admin-facing Telegram operations.
 *
 * These four endpoint groups are what the admin frontend's `telegramApi` has
 * always called, and none of them existed before this merge: broadcast lived at
 * `/v1/telegram/broadcast` (driver-facing, unauthenticated), and support tickets
 * plus analytics had no implementation at all.
 */
@Controller('admin/telegram')
@AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
@UseInterceptors(AuditInterceptor)
export class AdminTelegramController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly service: AdminTelegramService,
  ) {}

  /**
   * Fans a message out to drivers.
   *
   * Rate-limited hard: each call enqueues one Telegram send per matching driver,
   * so a loose limit here turns into a bulk-messaging amplifier.
   */
  @Post('broadcast')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  createBroadcast(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AdminBroadcastDto,
  ) {
    return this.telegram.createBroadcast({
      message: dto.message,
      imageUrl: dto.imageUrl,
      // The DTO is a closed shape; the service takes a plain record and turns
      // it into a Prisma `where`.
      targetFilter: dto.targetFilter ? { ...dto.targetFilter } : undefined,
      // Attributed to the authenticated admin, never guessed.
      sentBy: user.sub,
    });
  }

  @Get('broadcasts')
  listBroadcasts() {
    return this.service.listBroadcasts();
  }

  @Get('analytics')
  analytics() {
    return this.service.getTelegramAnalytics();
  }

  @Get('support-tickets')
  listSupportTickets(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listSupportTickets({ status, priority, page, limit });
  }

  @Patch('support-tickets/:id')
  updateSupportTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    return this.service.updateSupportTicket(id, dto);
  }

  @Patch('support-tickets/:id/assign')
  assignSupportTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSupportTicketDto,
  ) {
    return this.service.assignSupportTicket(id, dto.assignedTo);
  }
}
