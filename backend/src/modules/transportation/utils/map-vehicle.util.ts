import type { Prisma } from '@prisma/client';
import type { VehicleSummary } from '../interfaces/vehicle-summary.interface';
import type { VehicleDetail } from '../interfaces/vehicle-detail.interface';

export type VehicleRow = {
  id: string;
  vehicleType: string;
  name: string;
  licensePlate: string | null;
  capacity: number;
  priceUsd: Prisma.Decimal | number;
  pricingModel: string;
  province: string;
  images: string[];
};

function toNum(val: Prisma.Decimal | number): number {
  return typeof val === 'number' ? val : val.toNumber();
}

export function mapVehicleSummary(row: VehicleRow): VehicleSummary {
  return {
    id: row.id,
    vehicleType: row.vehicleType,
    name: row.name,
    capacity: row.capacity,
    priceUsd: toNum(row.priceUsd),
    pricingModel: row.pricingModel,
    province: row.province,
    coverImage: row.images[0] ?? null,
  };
}

export function mapVehicleDetail(row: VehicleRow): VehicleDetail {
  return {
    id: row.id,
    vehicleType: row.vehicleType,
    name: row.name,
    licensePlate: row.licensePlate,
    capacity: row.capacity,
    priceUsd: toNum(row.priceUsd),
    pricingModel: row.pricingModel,
    province: row.province,
    images: row.images,
  };
}
