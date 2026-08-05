import type { VehicleTier, VehicleSubtype } from '@prisma/client';

export interface VehicleDetail {
  id: string;
  vehicleType: string;
  name: string;
  licensePlate: string | null;
  capacity: number;
  tier: VehicleTier | null;
  subtype: VehicleSubtype | null;
  priceUsd: number;
  pricingModel: string;
  province: string;
  images: string[];
}
