import type { VehicleTier, VehicleSubtype } from '@prisma/client';

export interface VehicleSummary {
  id: string;
  vehicleType: string;
  name: string;
  capacity: number;
  tier: VehicleTier | null;
  subtype: VehicleSubtype | null;
  priceUsd: number;
  pricingModel: string;
  province: string;
  coverImage: string | null;
}
