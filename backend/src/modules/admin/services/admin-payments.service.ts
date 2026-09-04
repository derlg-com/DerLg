import { Injectable, Logger } from '@nestjs/common';
import {
  AuditEventType,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Read model for the admin payments screen, plus the audit trail for the two
 * manual interventions the ABA flow needs.
 *
 * The money-moving logic itself lives in `PaymentsService` — this service never
 * writes to `payments` or `refunds` directly, so there is exactly one code path
 * that can confirm a booking or move a refund total.
 */
@Injectable()
export class AdminPaymentsService {
  private readonly logger = new Logger(AdminPaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllPayments(filters: {
    provider?: PaymentProvider;
    status?: PaymentStatus;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
    limit?: string;
  }) {
    const currentPage = Math.max(1, parseInt(filters.page || '1', 10));
    const take = Math.min(
      100,
      Math.max(1, parseInt(filters.limit || '20', 10)),
    );
    const skip = (currentPage - 1) * take;

    const where: Prisma.PaymentWhereInput = {};
    if (filters.provider) where.provider = filters.provider;
    if (filters.status) where.status = filters.status;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    // The two identifiers an operator actually has: a booking code the customer
    // quoted, or a settlement id from a bank statement.
    if (filters.search) {
      where.OR = [
        {
          booking: {
            reference: { contains: filters.search, mode: 'insensitive' },
          },
        },
        {
          providerPaymentId: { contains: filters.search, mode: 'insensitive' },
        },
        {
          stripePaymentIntentId: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          provider: true,
          status: true,
          amountUsd: true,
          refundedAmountUsd: true,
          currency: true,
          providerPaymentId: true,
          stripePaymentIntentId: true,
          qrExpiresAt: true,
          paidAt: true,
          createdAt: true,
          // Deliberately NOT selecting qrPayload or clientSecret: both are payment
          // instruments, and an admin list has no use for either.
          booking: {
            select: { id: true, reference: true, status: true, totalUsd: true },
          },
          user: { select: { id: true, fullName: true, email: true } },
          refunds: {
            select: {
              id: true,
              amountUsd: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Payments that need a human.
   *
   * Drives the exception queue on the payments screen: an ABA payment whose QR has
   * expired while still pending is either money that arrived without a matching
   * alert, or an ambiguous match the listener refused to guess at.
   */
  async getAbaExceptions() {
    return this.prisma.payment.findMany({
      where: {
        provider: PaymentProvider.aba,
        status: PaymentStatus.pending,
        qrExpiresAt: { lt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        amountUsd: true,
        qrExpiresAt: true,
        createdAt: true,
        booking: { select: { id: true, reference: true, status: true } },
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async getAllRefunds(filters: {
    status?: PaymentStatus;
    provider?: PaymentProvider;
    search?: string;
    page?: string;
    limit?: string;
  }) {
    const currentPage = Math.max(1, parseInt(filters.page || '1', 10));
    const take = Math.min(
      100,
      Math.max(1, parseInt(filters.limit || '20', 10)),
    );
    const skip = (currentPage - 1) * take;

    const where: Prisma.RefundWhereInput = {};
    if (filters.status) where.status = filters.status;

    // Provider and reference both live on the related payment, so they are
    // composed into one nested filter rather than assigned twice — the second
    // assignment would silently discard the first.
    const paymentFilter: Prisma.PaymentWhereInput = {};
    if (filters.provider) paymentFilter.provider = filters.provider;
    if (filters.search) {
      paymentFilter.booking = {
        reference: { contains: filters.search, mode: 'insensitive' },
      };
    }
    if (Object.keys(paymentFilter).length > 0) where.payment = paymentFilter;

    const [data, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amountUsd: true,
          percentage: true,
          reason: true,
          status: true,
          providerRefundId: true,
          processedById: true,
          createdAt: true,
          payment: {
            select: {
              id: true,
              provider: true,
              amountUsd: true,
              refundedAmountUsd: true,
              booking: { select: { id: true, reference: true } },
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
      }),
      this.prisma.refund.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Writes an audit entry.
   *
   * Never allowed to fail the operation it describes: a settled payment that lost
   * its audit row is recoverable from the payment record, whereas throwing here
   * would leave the operator unsure whether the money moved.
   */
  async createAuditLog(input: {
    userId?: string;
    eventType: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId,
          eventType: input.eventType as AuditEventType,
          entityType: input.entityType,
          entityId: input.entityId,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn('Audit log creation failed', {
        error: (error as Error).message,
      });
    }
  }
}
