import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { vehicleListKey } from '../../../common/cache/cache-keys';
import { mapVehicleSummary } from '../utils';
import type { ListVehiclesDto } from '../dto';
import type { VehicleSummary } from '../interfaces';
import type { PaginatedResponse } from '../../../common/types/paginated-response.type';
import { Prisma } from '@prisma/client';

const VEHICLE_SELECT = {
  id: true,
  vehicleType: true,
  name: true,
  licensePlate: true,
  capacity: true,
  priceUsd: true,
  pricingModel: true,
  province: true,
  images: true,
} satisfies Prisma.TransportationVehicleSelect;

@Injectable()
export class ListVehiclesUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(
    query: ListVehiclesDto,
  ): Promise<PaginatedResponse<VehicleSummary>> {
    const { page = 1, limit = 20, type } = query;
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    const cacheKey = vehicleListKey({ page: safePage, limit: safeLimit, type });

    return this.cache.getOrSet(cacheKey, 300, async () => {
      const where: Prisma.TransportationVehicleWhereInput = {
        isActive: true,
        ...(type && { vehicleType: type }),
      };

      const [total, rows] = await Promise.all([
        this.prisma.transportationVehicle.count({ where }),
        this.prisma.transportationVehicle.findMany({
          where,
          select: VEHICLE_SELECT,
          skip: (safePage - 1) * safeLimit,
          take: safeLimit,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return {
        items: rows.map(mapVehicleSummary),
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      };
    });
  }
}
