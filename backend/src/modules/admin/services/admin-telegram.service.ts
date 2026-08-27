import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminRole,
  DriverStatus,
  Prisma,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Admin-side Telegram reporting and support-ticket handling.
 *
 * Split from `TelegramService`, which owns the driver-facing bot conversation.
 * This one only ever reads or curates what the bot produced.
 */
@Injectable()
export class AdminTelegramService {
  private readonly logger = new Logger(AdminTelegramService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listBroadcasts(): Promise<
    Array<{
      id: string;
      messageId: string;
      content: string;
      imageUrl: string | null;
      targetFilter: Prisma.JsonValue;
      status: string;
      sentCount: number;
      failedCount: number;
      completedAt: Date | null;
      createdAt: Date;
      sentBy: { id: string; email: string; fullName: string | null } | null;
    }>
  > {
    const broadcasts = await this.prisma.broadcastMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        messageId: true,
        content: true,
        imageUrl: true,
        targetFilter: true,
        status: true,
        sentCount: true,
        failedCount: true,
        completedAt: true,
        createdAt: true,
        // Resolvable now that sent_by has a foreign key to users.
        sender: { select: { id: true, email: true, fullName: true } },
      },
    });

    return broadcasts.map((b) => ({
      id: b.id,
      messageId: b.messageId,
      content: b.content,
      imageUrl: b.imageUrl,
      targetFilter: b.targetFilter,
      status: b.status,
      sentCount: b.sentCount,
      failedCount: b.failedCount,
      completedAt: b.completedAt,
      createdAt: b.createdAt,
      sentBy: b.sender,
    }));
  }

  /** Bot adoption and delivery health. */
  async getTelegramAnalytics() {
    const [
      totalDrivers,
      registeredDrivers,
      byStatus,
      broadcastTotals,
      ticketsByStatus,
      activeAssignments,
    ] = await Promise.all([
      this.prisma.driver.count(),
      // A non-null telegramId is the marker of a completed /start + PIN flow.
      this.prisma.driver.count({ where: { telegramId: { not: null } } }),
      this.prisma.driver.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.broadcastMessage.aggregate({
        _sum: { sentCount: true, failedCount: true },
        _count: { _all: true },
      }),
      this.prisma.supportTicket.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.driverAssignment.count({
        where: { status: { in: ['PENDING', 'ACCEPTED'] } },
      }),
    ]);

    const sent = broadcastTotals._sum.sentCount ?? 0;
    const failed = broadcastTotals._sum.failedCount ?? 0;
    const attempted = sent + failed;

    return {
      drivers: {
        total: totalDrivers,
        telegramRegistered: registeredDrivers,
        registrationRatePercent:
          totalDrivers > 0
            ? Math.round((registeredDrivers / totalDrivers) * 10000) / 100
            : 0,
        byStatus: Object.fromEntries(
          Object.values(DriverStatus).map((status) => [
            status,
            byStatus.find((row) => row.status === status)?._count._all ?? 0,
          ]),
        ),
      },
      broadcasts: {
        total: broadcastTotals._count._all,
        messagesSent: sent,
        messagesFailed: failed,
        deliveryRatePercent:
          attempted > 0 ? Math.round((sent / attempted) * 10000) / 100 : 0,
      },
      supportTickets: Object.fromEntries(
        Object.values(TicketStatus).map((status) => [
          status,
          ticketsByStatus.find((row) => row.status === status)?._count._all ??
            0,
        ]),
      ),
      activeAssignments,
    };
  }

  async listSupportTickets(filters: {
    status?: string;
    priority?: string;
    page?: string;
    limit?: string;
  }) {
    const currentPage = Math.max(1, parseInt(filters.page || '1', 10));
    const take = Math.min(
      100,
      Math.max(1, parseInt(filters.limit || '20', 10)),
    );
    const skip = (currentPage - 1) * take;

    const where: Prisma.SupportTicketWhereInput = {};

    // Unknown enum values would make Prisma throw, so they are rejected with a
    // 400 rather than surfacing as a 500.
    if (filters.status) {
      if (!(Object.values(TicketStatus) as string[]).includes(filters.status)) {
        throw new BadRequestException(
          `Invalid status. Expected one of: ${Object.values(TicketStatus).join(', ')}`,
        );
      }
      where.status = filters.status as TicketStatus;
    }

    if (filters.priority) {
      if (
        !(Object.values(TicketPriority) as string[]).includes(filters.priority)
      ) {
        throw new BadRequestException(
          `Invalid priority. Expected one of: ${Object.values(TicketPriority).join(', ')}`,
        );
      }
      where.priority = filters.priority as TicketPriority;
    }

    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          ticketId: true,
          message: true,
          status: true,
          priority: true,
          resolvedAt: true,
          createdAt: true,
          updatedAt: true,
          driver: {
            select: { id: true, driverName: true, driverId: true, phone: true },
          },
          assignee: { select: { id: true, email: true, fullName: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
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

  async updateSupportTicket(
    id: string,
    dto: {
      status?: TicketStatus;
      priority?: TicketPriority;
      assignedTo?: string;
    },
  ) {
    const existing = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, status: true, resolvedAt: true },
    });

    if (!existing) {
      throw new NotFoundException(`Support ticket ${id} not found`);
    }

    const isClosing =
      dto.status === TicketStatus.RESOLVED ||
      dto.status === TicketStatus.CLOSED;

    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: dto.status,
        priority: dto.priority,
        assignedTo: dto.assignedTo,
        // Stamp resolvedAt on the transition into a terminal state, and clear it
        // if the ticket is reopened, so the field always matches the status.
        resolvedAt: isClosing
          ? (existing.resolvedAt ?? new Date())
          : dto.status
            ? null
            : undefined,
      },
      select: {
        id: true,
        ticketId: true,
        status: true,
        priority: true,
        assignedTo: true,
        resolvedAt: true,
        updatedAt: true,
      },
    });
  }

  async assignSupportTicket(id: string, assignedTo: string) {
    const [ticket, assignee] = await Promise.all([
      this.prisma.supportTicket.findUnique({
        where: { id },
        select: { id: true },
      }),
      // Must be a real admin: the column has a foreign key to users, and handing
      // a driver ticket to a non-admin would silently orphan it.
      this.prisma.adminUser.findUnique({
        where: { userId: assignedTo },
        select: { userId: true, isActive: true, adminRole: true },
      }),
    ]);

    if (!ticket) {
      throw new NotFoundException(`Support ticket ${id} not found`);
    }
    if (!assignee) {
      throw new BadRequestException(
        `User ${assignedTo} is not an admin and cannot be assigned tickets`,
      );
    }
    if (!assignee.isActive) {
      throw new BadRequestException(
        `Admin ${assignedTo} is deactivated and cannot be assigned tickets`,
      );
    }
    if (assignee.adminRole === AdminRole.FLEET_MANAGER) {
      this.logger.warn('Assigning a support ticket to a FLEET_MANAGER', {
        ticketId: id,
        assignedTo,
      });
    }

    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        assignedTo,
        status: TicketStatus.IN_PROGRESS,
      },
      select: {
        id: true,
        ticketId: true,
        status: true,
        assignedTo: true,
        assignee: { select: { id: true, email: true, fullName: true } },
      },
    });
  }
}
