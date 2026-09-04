import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AuditEventType, MaintenanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminMaintenanceService {
  private readonly logger = new Logger(AdminMaintenanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMaintenanceSchedule(filters: {
    vehicleId?: string;
    status?: MaintenanceStatus;
    startDate?: string;
    endDate?: string;
    page?: string;
    limit?: string;
  }) {
    const { vehicleId, status, startDate, endDate, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: Prisma.VehicleMaintenanceWhereInput = {};

    if (vehicleId) where.vehicleId = vehicleId;
    // The scheduler UI sends `?status=SCHEDULED`; there was no `status` filter,
    // so it silently listed completed records alongside upcoming ones.
    if (status) where.status = status;
    if (startDate || endDate) {
      where.scheduledDate = {};
      if (startDate) where.scheduledDate.gte = new Date(startDate);
      if (endDate) where.scheduledDate.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.vehicleMaintenance.findMany({
        where,
        skip,
        take,
        orderBy: { scheduledDate: 'asc' },
      }),
      this.prisma.vehicleMaintenance.count({ where }),
    ]);

    const vehicleIds = [...new Set(data.map((m) => m.vehicleId))];
    const vehicles = await this.prisma.transportationVehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { id: true, name: true, licensePlate: true },
    });
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

    const dataWithVehicle = data.map((m) => ({
      ...m,
      vehicle: vehicleMap.get(m.vehicleId) || null,
    }));

    return {
      data: dataWithVehicle,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getMaintenanceHistory(vehicleId: string) {
    const records = await this.prisma.vehicleMaintenance.findMany({
      where: { vehicleId },
      orderBy: { scheduledDate: 'desc' },
    });

    const vehicle = await this.prisma.transportationVehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, name: true, licensePlate: true },
    });

    return records.map((r) => ({ ...r, vehicle }));
  }

  async getUpcomingMaintenance() {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const records = await this.prisma.vehicleMaintenance.findMany({
      where: {
        scheduledDate: {
          gte: today,
          lte: threeDaysFromNow,
        },
        status: {
          in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_MAINTENANCE],
        },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    const vehicleIds = [...new Set(records.map((m) => m.vehicleId))];
    const vehicles = await this.prisma.transportationVehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { id: true, name: true, licensePlate: true },
    });
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

    return records.map((m) => ({
      ...m,
      vehicle: vehicleMap.get(m.vehicleId) || null,
    }));
  }

  async scheduleMaintenance(dto: {
    vehicleId: string;
    maintenanceType: string;
    scheduledDate: string;
    maintenanceNotes?: string;
  }) {
    const vehicle = await this.prisma.transportationVehicle.findUnique({
      where: { id: dto.vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with id ${dto.vehicleId} not found`);
    }

    const maintenance = await this.prisma.vehicleMaintenance.create({
      data: {
        vehicleId: dto.vehicleId,
        maintenanceType: dto.maintenanceType,
        scheduledDate: new Date(dto.scheduledDate),
        maintenanceNotes: dto.maintenanceNotes || null,
        status: MaintenanceStatus.SCHEDULED,
      },
    });

    return maintenance;
  }

  async updateMaintenanceStatus(
    id: string,
    dto: {
      status?: MaintenanceStatus;
      completionDate?: string;
      maintenanceCost?: number;
      maintenanceNotes?: string;
    },
  ) {
    const existing = await this.prisma.vehicleMaintenance.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Maintenance record with id ${id} not found`);
    }

    if (dto.status) {
      this.validateStatusTransition(existing.status, dto.status);
    }

    const data: Prisma.VehicleMaintenanceUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.completionDate !== undefined) {
      data.completionDate = new Date(dto.completionDate);
    }
    if (dto.maintenanceCost !== undefined) {
      data.maintenanceCost = dto.maintenanceCost;
    }
    if (dto.maintenanceNotes !== undefined) {
      data.maintenanceNotes = dto.maintenanceNotes;
    }

    return this.prisma.vehicleMaintenance.update({
      where: { id },
      data,
    });
  }

  async isVehicleInMaintenance(vehicleId: string): Promise<boolean> {
    const count = await this.prisma.vehicleMaintenance.count({
      where: {
        vehicleId,
        status: MaintenanceStatus.IN_MAINTENANCE,
      },
    });
    return count > 0;
  }

  private validateStatusTransition(
    current: MaintenanceStatus,
    next: MaintenanceStatus,
  ): void {
    const allowedTransitions: Record<MaintenanceStatus, MaintenanceStatus[]> = {
      [MaintenanceStatus.SCHEDULED]: [
        MaintenanceStatus.IN_MAINTENANCE,
        MaintenanceStatus.COMPLETED,
      ],
      [MaintenanceStatus.IN_MAINTENANCE]: [MaintenanceStatus.COMPLETED],
      [MaintenanceStatus.COMPLETED]: [],
    };

    if (!allowedTransitions[current].includes(next)) {
      throw new BadRequestException(
        `Invalid status transition from ${current} to ${next}`,
      );
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
