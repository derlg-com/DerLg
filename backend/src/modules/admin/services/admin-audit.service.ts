import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, AuditEventType } from '@prisma/client';

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllAuditLogs(filters: {
    startDate?: string;
    endDate?: string;
    adminUserId?: string;
    actionType?: string;
    page?: string;
    limit?: string;
  }) {
    const { page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: Prisma.AuditLogWhereInput = {};
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }
    if (filters.adminUserId) where.userId = filters.adminUserId;
    if (filters.actionType) {
      // Narrow to the enum. Passing an unknown value straight to Prisma throws,
      // which would surface a 500 for what is really a bad query parameter.
      if (
        !(Object.values(AuditEventType) as string[]).includes(
          filters.actionType,
        )
      ) {
        throw new BadRequestException(
          `Invalid actionType. Expected one of: ${Object.values(AuditEventType).join(', ')}`,
        );
      }
      where.eventType = filters.actionType as AuditEventType;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { email: true, fullName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const mapped = data.map((log) => ({
      id: log.id,
      userId: log.userId,
      user: log.user,
      eventType: log.eventType,
      entityType: log.entityType,
      entityId: log.entityId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata,
      createdAt: log.createdAt,
    }));

    return {
      data: mapped,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async createAuditLog(params: {
    userId?: string;
    eventType: AuditEventType;
    entityType: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        eventType: params.eventType,
        entityType: params.entityType,
        entityId: params.entityId || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async exportAuditLogs(filters: {
    startDate?: string;
    endDate?: string;
    adminUserId?: string;
    actionType?: string;
  }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }
    if (filters.adminUserId) where.userId = filters.adminUserId;
    if (filters.actionType) {
      // Narrow to the enum. Passing an unknown value straight to Prisma throws,
      // which would surface a 500 for what is really a bad query parameter.
      if (
        !(Object.values(AuditEventType) as string[]).includes(
          filters.actionType,
        )
      ) {
        throw new BadRequestException(
          `Invalid actionType. Expected one of: ${Object.values(AuditEventType).join(', ')}`,
        );
      }
      where.eventType = filters.actionType as AuditEventType;
    }

    const data = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { email: true, fullName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const mapped = data.map((log) => ({
      id: log.id,
      userId: log.userId,
      userEmail: log.user?.email || '',
      eventType: log.eventType,
      entityType: log.entityType,
      entityId: log.entityId || '',
      ipAddress: log.ipAddress || '',
      createdAt: log.createdAt.toISOString(),
      metadata: JSON.stringify(log.metadata || {}),
    }));

    return { format: 'csv', content: this.toCsv(mapped) };
  }

  /**
   * Serialises rows to CSV.
   *
   * Values are quoted whenever they contain a comma, quote or newline, with
   * embedded quotes doubled per RFC 4180. The previous versions only quoted on a
   * comma, so a value containing a bare quote or a newline — a cancellation
   * reason typed by an admin, for instance — corrupted the row.
   */
  private toCsv(data: Array<Record<string, unknown>>): string {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);

    const escape = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const raw =
        typeof value === 'string'
          ? value
          : typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : value instanceof Date
              ? value.toISOString()
              : JSON.stringify(value);
      return /["\n\r,]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
    };

    const rows = data.map((row) =>
      headers.map((h) => escape(row[h])).join(','),
    );
    return [headers.map(escape).join(','), ...rows].join('\n');
  }
}
