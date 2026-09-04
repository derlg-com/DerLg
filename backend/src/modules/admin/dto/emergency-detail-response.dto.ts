import { EmergencyAlertStatus, EmergencyAlertType } from '@prisma/client';

export class EmergencyDetailResponseDto {
  id: string;
  userId: string;
  user?: {
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
  } | null;
  alertType: EmergencyAlertType;
  status: EmergencyAlertStatus;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  resolvedAt: Date | null;
  notes: string | null;
  driver?: {
    id: string;
    driverName: string;
    phone: string;
    status: string;
  } | null;
  /** Raw FK, kept alongside the resolved relation for clients that only need the id. */
  driverId?: string | null;
  createdAt: Date;
}
