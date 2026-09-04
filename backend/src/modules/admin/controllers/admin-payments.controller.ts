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
import { AdminRole } from '@prisma/client';

import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AdminRoles } from '../../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RateLimit } from '../../../common/throttler/rate-limit';
import { AdminPaymentsService } from '../services/admin-payments.service';
import { PaymentsService } from '../../payments/services/payments.service';
import {
  CompleteRefundDto,
  ListPaymentsDto,
  ListRefundsDto,
  SettlePaymentManuallyDto,
} from '../dto/admin-payments.dto';

/**
 * Payment operations for the admin panel.
 *
 * Reads are open to support agents, who field "did my payment go through?"
 * questions. The two write actions are not: both move money or mark money as
 * moved, so they are restricted to OPERATIONS_MANAGER and SUPER_ADMIN and every
 * one of them is audit-logged with the operator's justification.
 */
@Controller('admin/payments')
@AdminRoles(
  AdminRole.SUPPORT_AGENT,
  AdminRole.OPERATIONS_MANAGER,
  AdminRole.SUPER_ADMIN,
)
@RateLimit('ADMIN')
@UseInterceptors(AuditInterceptor)
export class AdminPaymentsController {
  constructor(
    private readonly service: AdminPaymentsService,
    private readonly payments: PaymentsService,
  ) {}

  @Get()
  getAllPayments(@Query() query: ListPaymentsDto) {
    return this.service.getAllPayments({
      provider: query.provider,
      status: query.status,
      search: query.search,
      startDate: query.start_date,
      endDate: query.end_date,
      page: query.page?.toString(),
      limit: query.limit?.toString(),
    });
  }

  /**
   * ABA payments that expired while still pending.
   *
   * These are the cases the Telegram listener could not resolve on its own: money
   * that arrived with no matching payment, or two pending payments sharing an
   * amount, where settling the wrong one would confirm a stranger's booking.
   */
  @Get('aba-exceptions')
  async getAbaExceptions() {
    const data = await this.service.getAbaExceptions();
    return { success: true, data, message: 'ok', error: null };
  }

  /**
   * Settles an ABA payment against a verified bank transaction.
   *
   * The highest-privilege action in this module: it confirms a booking. Gated to
   * OPERATIONS_MANAGER and above, requires the numeric ABA transaction id, and
   * requires a written reason — all three end up in the audit log.
   */
  @Post(':id/settle')
  @AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
  @RateLimit('WRITE')
  async settleManually(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettlePaymentManuallyDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.payments.settleManually({
      paymentId: id,
      abaTrxId: dto.abaTrxId,
      adminUserId: userId ?? 'unknown',
    });

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'PAYMENT',
      entityId: id,
      metadata: {
        action: 'SETTLE_PAYMENT_MANUALLY',
        abaTrxId: dto.abaTrxId,
        reason: dto.reason,
        bookingId: result.bookingId,
      },
    });

    return {
      success: true,
      data: result,
      message: 'Payment settled and booking confirmed',
      error: null,
    };
  }
}

/**
 * Refund payouts.
 *
 * Split from the payments controller because it is a different resource with a
 * different route root, not because the concerns differ.
 */
@Controller('admin/refunds')
@AdminRoles(
  AdminRole.SUPPORT_AGENT,
  AdminRole.OPERATIONS_MANAGER,
  AdminRole.SUPER_ADMIN,
)
@RateLimit('ADMIN')
@UseInterceptors(AuditInterceptor)
export class AdminRefundsController {
  constructor(
    private readonly service: AdminPaymentsService,
    private readonly payments: PaymentsService,
  ) {}

  @Get()
  getAllRefunds(@Query() query: ListRefundsDto) {
    return this.service.getAllRefunds({
      status: query.status,
      provider: query.provider,
      search: query.search,
      page: query.page?.toString(),
      limit: query.limit?.toString(),
    });
  }

  /**
   * Confirms that a queued ABA refund was actually transferred.
   *
   * ABA has no refund API, so `refundForCancellation` leaves the payment's
   * `refunded_amount_usd` untouched and queues the work. This is where those
   * totals move — after a human has made the transfer, not before.
   */
  @Patch(':id/complete')
  @AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
  @RateLimit('WRITE')
  async completeRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteRefundDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.payments.completeManualRefund({
      refundId: id,
      providerRefundId: dto.providerRefundId,
      adminUserId: userId ?? 'unknown',
    });

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'REFUND',
      entityId: id,
      metadata: {
        action: 'COMPLETE_MANUAL_REFUND',
        providerRefundId: dto.providerRefundId,
        reason: dto.reason,
        paymentId: result.paymentId,
      },
    });

    return {
      success: true,
      data: result,
      message: 'Refund payout recorded',
      error: null,
    };
  }
}
