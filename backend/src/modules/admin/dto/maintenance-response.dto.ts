import { MaintenanceStatus } from '@prisma/client';

export class MaintenanceResponseDto {
  id: string;
  vehicleId: string;
  maintenanceType: string;
  scheduledDate: Date;
  completionDate: Date | null;
  maintenanceCost: number | null;
  maintenanceNotes: string | null;
  status: MaintenanceStatus;
  createdAt: Date;
  updatedAt: Date;
  vehicle?: {
    id: string;
    name: string;
    licensePlate: string | null;
  } | null;
}
