import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import {
  EmergencyAlertType,
  AuditEventType,
  EmergencyAlertStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { EmergencyDetailResponseDto } from '../dto/emergency-detail-response.dto';

@Injectable()
export class AdminEmergencyService {
  private readonly logger = new Logger(AdminEmergencyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getAllEmergencyAlerts(filters: {
    status?: EmergencyAlertStatus;
    alertType?: EmergencyAlertType;
    page?: string;
    limit?: string;
  }) {
    const { status, alertType, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: Prisma.EmergencyAlertWhereInput = {};

    // Typed, not cast. These used to be `status as EmergencyAlertStatus` on a raw
    // query string, so `?status=open` reached Prisma as an invalid enum value and
    // surfaced as a 500 instead of a 400 naming the bad parameter.
    if (status) {
      where.status = status;
    }

    if (alertType) {
      where.alertType = alertType;
    }

    const [data, total] = await Promise.all([
      this.prisma.emergencyAlert.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
            },
          },
          driver: {
            select: {
              id: true,
              driverName: true,
              phone: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.emergencyAlert.count({ where }),
    ]);

    const mapped = data.map((alert) => ({
      id: alert.id,
      userId: alert.userId,
      user: alert.user,
      alertType: alert.alertType,
      status: alert.status,
      latitude: Number(alert.latitude),
      longitude: Number(alert.longitude),
      accuracyMeters: alert.accuracyMeters
        ? Number(alert.accuracyMeters)
        : null,
      acknowledgedAt: alert.acknowledgedAt,
      acknowledgedBy: alert.acknowledgedBy,
      resolvedAt: alert.resolvedAt,
      notes: alert.notes,
      // The Driver relation, reachable now that emergency_alerts.driver_id has a
      // real FK. Before the merge the column existed but resolved to nothing.
      driver: alert.driver,
      driverId: alert.driverId,
      createdAt: alert.createdAt,
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

  async getEmergencyAlertById(id: string): Promise<EmergencyDetailResponseDto> {
    const alert = await this.prisma.emergencyAlert.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
          },
        },
        driver: {
          select: {
            id: true,
            driverName: true,
            phone: true,
            status: true,
          },
        },
      },
    });

    if (!alert) {
      throw new NotFoundException(`Emergency alert with id ${id} not found`);
    }

    return {
      id: alert.id,
      userId: alert.userId,
      user: alert.user,
      alertType: alert.alertType,
      status: alert.status,
      latitude: Number(alert.latitude),
      longitude: Number(alert.longitude),
      accuracyMeters: alert.accuracyMeters
        ? Number(alert.accuracyMeters)
        : null,
      acknowledgedAt: alert.acknowledgedAt,
      acknowledgedBy: alert.acknowledgedBy,
      resolvedAt: alert.resolvedAt,
      notes: alert.notes,
      // The Driver relation, reachable now that emergency_alerts.driver_id has a
      // real FK. Before the merge the column existed but resolved to nothing.
      driver: alert.driver,
      driverId: alert.driverId,
      createdAt: alert.createdAt,
    };
  }

  async acknowledgeAlert(id: string, acknowledgedBy?: string) {
    const existing = await this.prisma.emergencyAlert.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Emergency alert with id ${id} not found`);
    }

    if (existing.status === EmergencyAlertStatus.resolved) {
      throw new NotFoundException('Cannot acknowledge a resolved alert');
    }

    if (existing.status === EmergencyAlertStatus.cancelled) {
      throw new NotFoundException('Cannot acknowledge a cancelled alert');
    }

    const alert = await this.prisma.emergencyAlert.update({
      where: { id },
      data: {
        status: EmergencyAlertStatus.acknowledged,
        acknowledgedAt: new Date(),
        acknowledgedBy: acknowledgedBy || null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
          },
        },
        driver: {
          select: {
            id: true,
            driverName: true,
            phone: true,
            status: true,
          },
        },
      },
    });

    await this.publishEmergencyEvent({
      alertId: alert.id,
      alertType: alert.alertType,
      status: alert.status,
      userId: alert.userId,
      lat: Number(alert.latitude),
      lng: Number(alert.longitude),
      timestamp: new Date().toISOString(),
      action: 'ACKNOWLEDGED',
    });

    return {
      id: alert.id,
      userId: alert.userId,
      user: alert.user,
      alertType: alert.alertType,
      status: alert.status,
      latitude: Number(alert.latitude),
      longitude: Number(alert.longitude),
      accuracyMeters: alert.accuracyMeters
        ? Number(alert.accuracyMeters)
        : null,
      acknowledgedAt: alert.acknowledgedAt,
      acknowledgedBy: alert.acknowledgedBy,
      resolvedAt: alert.resolvedAt,
      notes: alert.notes,
      // The Driver relation, reachable now that emergency_alerts.driver_id has a
      // real FK. Before the merge the column existed but resolved to nothing.
      driver: alert.driver,
      driverId: alert.driverId,
      createdAt: alert.createdAt,
    };
  }

  /**
   * Marks an alert resolved.
   *
   * `resolvedBy` used to be accepted and discarded, so the audit trail could not
   * say who closed an emergency. It is now recorded via `acknowledgedBy` when the
   * alert had not already been acknowledged by someone else.
   */
  async resolveAlert(id: string, notes?: string, resolvedBy?: string) {
    const existing = await this.prisma.emergencyAlert.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Emergency alert with id ${id} not found`);
    }

    if (existing.status === EmergencyAlertStatus.resolved) {
      throw new NotFoundException('Alert is already resolved');
    }

    if (existing.status === EmergencyAlertStatus.cancelled) {
      throw new NotFoundException('Cannot resolve a cancelled alert');
    }

    const alert = await this.prisma.emergencyAlert.update({
      where: { id },
      data: {
        status: EmergencyAlertStatus.resolved,
        resolvedAt: new Date(),
        notes: notes || existing.notes,
        // Records who closed the alert. `resolvedBy` was previously accepted and
        // then discarded, so an emergency could be resolved with no trace of who
        // did it. Only set when nobody had acknowledged it first, so the original
        // responder is not overwritten.
        acknowledgedBy: existing.acknowledgedBy ?? resolvedBy ?? null,
        acknowledgedAt: existing.acknowledgedAt ?? new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
          },
        },
        driver: {
          select: {
            id: true,
            driverName: true,
            phone: true,
            status: true,
          },
        },
      },
    });

    await this.publishEmergencyEvent({
      alertId: alert.id,
      alertType: alert.alertType,
      status: alert.status,
      userId: alert.userId,
      lat: Number(alert.latitude),
      lng: Number(alert.longitude),
      timestamp: new Date().toISOString(),
      action: 'RESOLVED',
      notes: notes || undefined,
    });

    return {
      id: alert.id,
      userId: alert.userId,
      user: alert.user,
      alertType: alert.alertType,
      status: alert.status,
      latitude: Number(alert.latitude),
      longitude: Number(alert.longitude),
      accuracyMeters: alert.accuracyMeters
        ? Number(alert.accuracyMeters)
        : null,
      acknowledgedAt: alert.acknowledgedAt,
      acknowledgedBy: alert.acknowledgedBy,
      resolvedAt: alert.resolvedAt,
      notes: alert.notes,
      // The Driver relation, reachable now that emergency_alerts.driver_id has a
      // real FK. Before the merge the column existed but resolved to nothing.
      driver: alert.driver,
      driverId: alert.driverId,
      createdAt: alert.createdAt,
    };
  }

  private async publishEmergencyEvent(payload: {
    alertId: string;
    alertType: string;
    status: string;
    userId: string;
    lat: number;
    lng: number;
    timestamp: string;
    action: string;
    notes?: string;
  }): Promise<void> {
    const channel = 'emergency_alerts';

    try {
      await this.redis.getClient().publish(channel, JSON.stringify(payload));
      this.logger.debug(`Published emergency event to ${channel}`);
    } catch (error) {
      this.logger.warn(`Redis publish failed: ${(error as Error).message}`);
    }
  }

  async createAuditLog(params: {
    userId?: string;
    eventType: AuditEventType;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          eventType: params.eventType,
          entityType: params.entityType,
          entityId: params.entityId || null,
          metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Audit log creation failed: ${(error as Error).message}`,
      );
    }
  }
}
