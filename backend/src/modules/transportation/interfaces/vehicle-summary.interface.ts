export interface VehicleSummary {
  id: string;
  vehicleType: string;
  name: string;
  capacity: number;
  priceUsd: number;
  pricingModel: string;
  province: string;
  coverImage: string | null;
}
