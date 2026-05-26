export interface VehicleDetail {
  id: string;
  vehicleType: string;
  name: string;
  licensePlate: string | null;
  capacity: number;
  priceUsd: number;
  pricingModel: string;
  province: string;
  images: string[];
}
