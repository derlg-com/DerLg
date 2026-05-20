import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { vehicleDetailKey } from '../../../common/cache/cache-keys';
import { ErrorCode } from '../../../common/errors/error-codes';
import { mapVehicleDetail } from '../utils';
import type { VehicleDetail } from '../interfaces';
import type { Lang } from '../../../common/i18n';
import { Prisma } from '@prisma/client';

const VEHICLE_DETAIL_SELECT = {
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
export class GetVehicleDetailUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(id: string, lang: Lang): Promise<VehicleDetail> {
    const row = await this.prisma.transportationVehicle.findFirst({
      where: { id, isActive: true },
      select: VEHICLE_DETAIL_SELECT,
    });

    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.TRN_NOT_FOUND,
        message: 'Vehicle not found',
      });
    }

    return this.cache.getOrSet(vehicleDetailKey(id, lang), 600, () =>
      Promise.resolve(mapVehicleDetail(row)),
    );
  }
}
