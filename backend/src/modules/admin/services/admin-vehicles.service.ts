import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VehicleResponseDto } from '../dto/vehicle-response.dto';
import {
  PricingModel,
  AuditEventType,
  Prisma,
  VehicleType,
  VehicleTier,
} from '@prisma/client';

@Injectable()
export class AdminVehiclesService {
  private readonly logger = new Logger(AdminVehiclesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllVehicles(filters: {
    category?: string;
    tier?: string;
    search?: string;
    page?: string;
    limit?: string;
  }) {
    const { category, tier, search, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: Prisma.TransportationVehicleWhereInput = {};
    if (category) where.vehicleType = category as VehicleType;
    if (tier) where.tier = tier as VehicleTier;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { licensePlate: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.transportationVehicle.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          drivers: {
            select: { id: true, driverName: true, status: true },
            take: 1,
          },
        },
      }),
      this.prisma.transportationVehicle.count({ where }),
    ]);

    const mapped = data.map((v) => ({
      ...v,
      assignedDriver: v.drivers?.[0]
        ? { id: v.drivers[0].id, driverName: v.drivers[0].driverName }
        : null,
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

  async getVehicleById(id: string): Promise<VehicleResponseDto> {
    const vehicle = await this.prisma.transportationVehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with id ${id} not found`);
    }

    const assignedDriver = await this.prisma.driver.findFirst({
      where: { vehicleId: id },
      select: {
        id: true,
        driverName: true,
        driverId: true,
        status: true,
        phone: true,
      },
    });

    const maintenanceHistory = await this.prisma.vehicleMaintenance.findMany({
      where: { vehicleId: id },
      orderBy: { scheduledDate: 'desc' },
      select: {
        id: true,
        maintenanceType: true,
        scheduledDate: true,
        status: true,
      },
    });

    const activeMaintenance = maintenanceHistory.find(
      (m) => m.status === 'IN_MAINTENANCE' || m.status === 'SCHEDULED',
    );

    return {
      id: vehicle.id,
      name: vehicle.name,
      vehicleType: vehicle.vehicleType,
      licensePlate: vehicle.licensePlate,
      capacity: vehicle.capacity,
      pricingModel: vehicle.pricingModel,
      priceUsd: Number(vehicle.priceUsd),
      province: vehicle.province,
      images: vehicle.images,
      isActive: vehicle.isActive,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
      assignedDriver: assignedDriver || null,
      maintenanceStatus: activeMaintenance?.status || null,
      maintenanceHistory:
        maintenanceHistory.length > 0 ? maintenanceHistory : undefined,
    };
  }

  async createVehicle(dto: {
    name: string;
    vehicleType: VehicleType;
    licensePlate?: string;
    capacity: number;
    pricingModel: PricingModel;
    priceUsd: number;
    province: string;
    images?: string[];
  }) {
    return this.prisma.transportationVehicle.create({
      data: {
        name: dto.name,
        vehicleType: dto.vehicleType,
        licensePlate: dto.licensePlate || null,
        capacity: dto.capacity,
        pricingModel: dto.pricingModel,
        priceUsd: dto.priceUsd,
        province: dto.province,
        images: dto.images || [],
      },
    });
  }

  async updateVehicle(
    id: string,
    dto: {
      name?: string;
      vehicleType?: VehicleType;
      licensePlate?: string;
      capacity?: number;
      pricingModel?: PricingModel;
      priceUsd?: number;
      province?: string;
      images?: string[];
      isActive?: boolean;
    },
    adminUserId?: string,
  ) {
    const existing = await this.prisma.transportationVehicle.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Vehicle with id ${id} not found`);
    }

    const oldPrice = Number(existing.priceUsd);
    const newPrice = dto.priceUsd !== undefined ? dto.priceUsd : oldPrice;

    const vehicle = await this.prisma.transportationVehicle.update({
      where: { id },
      data: {
        name: dto.name,
        vehicleType: dto.vehicleType,
        licensePlate: dto.licensePlate,
        capacity: dto.capacity,
        pricingModel: dto.pricingModel,
        priceUsd: dto.priceUsd,
        province: dto.province,
        images: dto.images,
        isActive: dto.isActive,
      },
    });

    if (dto.priceUsd !== undefined && newPrice !== oldPrice) {
      await this.createAuditLog({
        userId: adminUserId,
        eventType: 'admin_action',
        entityType: 'VEHICLE',
        entityId: id,
        metadata: {
          action: 'PRICING_CHANGE',
          oldPrice,
          newPrice,
          vehicleName: vehicle.name,
        },
      });
    }

    return vehicle;
  }

  /**
   * Soft-deletes a vehicle by clearing `isActive`.
   *
   * There is deliberately no hard delete. `transportation_vehicles` is
   * referenced by historical `booking_items`, so a real DELETE would either be
   * rejected by the foreign key or orphan completed bookings and break revenue
   * reporting. The admin panel's "delete" action maps here.
   */
  async deactivateVehicle(id: string) {
    const existing = await this.prisma.transportationVehicle.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!existing) {
      throw new NotFoundException(`Vehicle with id ${id} not found`);
    }

    return this.prisma.transportationVehicle.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getVehicleAvailability(id: string) {
    const vehicle = await this.prisma.transportationVehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with id ${id} not found`);
    }

    const assignedDriver = await this.prisma.driver.findFirst({
      where: { vehicleId: id },
      select: { status: true },
    });

    const activeMaintenance = await this.prisma.vehicleMaintenance.findFirst({
      where: {
        vehicleId: id,
        status: { in: ['SCHEDULED', 'IN_MAINTENANCE'] },
      },
    });

    const isAvailable =
      vehicle.isActive &&
      assignedDriver?.status === 'AVAILABLE' &&
      !activeMaintenance;

    return {
      vehicleId: id,
      isAvailable,
      reason: isAvailable
        ? 'Available for assignment'
        : !vehicle.isActive
          ? 'Vehicle is inactive'
          : activeMaintenance
            ? `Vehicle is in maintenance (${activeMaintenance.status})`
            : assignedDriver?.status !== 'AVAILABLE'
              ? `Assigned driver is ${assignedDriver?.status || 'not assigned'}`
              : 'Unavailable',
      driverStatus: assignedDriver?.status || null,
      maintenanceStatus: activeMaintenance?.status || null,
    };
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
