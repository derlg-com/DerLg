import { AssignmentStatus } from '@prisma/client';

export class AssignmentResponseDto {
  id: string;
  driverId: string;
  bookingId: string;
  vehicleId: string;
  status: AssignmentStatus;
  assignmentTimestamp: Date;
  responseTimestamp: Date | null;
  tripStartTime: Date | null;
  completionTimestamp: Date | null;
  rejectionReason: string | null;
  telegramNotified: boolean;
  createdAt: Date;
  updatedAt: Date;
  driver?: {
    id: string;
    driverName: string;
    driverId: string;
    phone: string;
    status: string;
  } | null;
  booking?: {
    id: string;
    reference: string;
    passengerCount: number;
    status: string;
    startDate: Date;
  } | null;
  vehicle?: {
    id: string;
    name: string;
    vehicleType: string;
    capacity: number;
    licensePlate: string | null;
  } | null;
}
