import { VehicleType, PricingModel } from '@prisma/client';

export class VehicleResponseDto {
  id: string;
  name: string;
  vehicleType: VehicleType;
  licensePlate: string | null;
  capacity: number;
  pricingModel: PricingModel;
  priceUsd: number;
  province: string;
  images: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  assignedDriver?: {
    id: string;
    driverName: string;
    driverId: string;
    status: string;
    phone: string;
  } | null;
  maintenanceStatus?: 'SCHEDULED' | 'IN_MAINTENANCE' | 'COMPLETED' | null;
  maintenanceHistory?: Array<{
    id: string;
    maintenanceType: string;
    scheduledDate: Date;
    status: string;
  }>;
}
