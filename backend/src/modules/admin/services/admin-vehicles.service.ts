import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheInvalidationService } from '../../../common/cache/cache-invalidation.service';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheInvalidation?: CacheInvalidationService,
  ) {}

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
    name?: string;
    vehicleType?: VehicleType;
    vehicle_type?: VehicleType;
    licensePlate?: string;
    license_plate?: string;
    capacity: number;
    pricingModel?: PricingModel;
    pricing_model?: PricingModel;
    priceUsd?: number;
    price_usd?: number;
    province: string;
    features?: string[];
    images?: string[];
    make?: string;
    model?: string;
    year?: number;
    plateNumber?: string;
    plate_number?: string;
    pricePerDayUsd?: number;
    price_per_day_usd?: number;
  }) {
    const name = dto.name || [dto.make, dto.model].filter(Boolean).join(' ') || 'Vehicle';
    const vehicleType = dto.vehicleType || dto.vehicle_type || VehicleType.van;
    const pricingModel = dto.pricingModel || dto.pricing_model || PricingModel.per_day;
    const priceUsd = dto.priceUsd ?? dto.price_usd ?? dto.pricePerDayUsd ?? dto.price_per_day_usd ?? 0;
    const licensePlate = dto.licensePlate ?? dto.license_plate ?? dto.plateNumber ?? dto.plate_number ?? null;

    const vehicle = await this.prisma.transportationVehicle.create({
      data: {
        name,
        vehicleType,
        licensePlate,
        capacity: dto.capacity,
        pricingModel,
        priceUsd,
        province: dto.province,
        images: dto.images || [],
      },
    });

    await this.cacheInvalidation?.invalidateVehicleCaches(vehicle.id);
    return vehicle;
  }

  async updateVehicle(
    id: string,
    dto: {
      name?: string;
      vehicleType?: VehicleType;
      vehicle_type?: VehicleType;
      licensePlate?: string;
      license_plate?: string;
      capacity?: number;
      pricingModel?: PricingModel;
      pricing_model?: PricingModel;
      priceUsd?: number;
      price_usd?: number;
      province?: string;
      features?: string[];
      images?: string[];
      isActive?: boolean;
      make?: string;
      model?: string;
      year?: number;
      plateNumber?: string;
      plate_number?: string;
      pricePerDayUsd?: number;
      price_per_day_usd?: number;
    },
    adminUserId?: string,
  ) {
    const existing = await this.prisma.transportationVehicle.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Vehicle with id ${id} not found`);
    }

    const name = dto.name || (dto.make || dto.model ? [dto.make, dto.model].filter(Boolean).join(' ') : undefined);
    const vehicleType = dto.vehicleType || dto.vehicle_type;
    const pricingModel = dto.pricingModel || dto.pricing_model;
    const priceUsd = dto.priceUsd ?? dto.price_usd ?? dto.pricePerDayUsd ?? dto.price_per_day_usd;
    const licensePlate = dto.licensePlate ?? dto.license_plate ?? dto.plateNumber ?? dto.plate_number;

    const oldPrice = Number(existing.priceUsd);
    const newPrice = priceUsd !== undefined ? priceUsd : oldPrice;

    const vehicle = await this.prisma.transportationVehicle.update({
      where: { id },
      data: {
        name,
        vehicleType,
        licensePlate,
        capacity: dto.capacity,
        pricingModel,
        priceUsd,
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

    await this.cacheInvalidation?.invalidateVehicleCaches(vehicle.id);
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

    const updated = await this.prisma.transportationVehicle.update({
      where: { id },
      data: { isActive: false },
    });

    await this.cacheInvalidation?.invalidateVehicleCaches(id);
    return updated;
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
