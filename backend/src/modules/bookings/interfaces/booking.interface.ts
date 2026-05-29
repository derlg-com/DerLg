import type {
  BookingStatus,
  BookingMethod,
  SingleResourceKind,
} from '@prisma/client';

/** Public Booking summary (used by list endpoints + nested in BookingDetail). */
export interface Booking {
  id: string;
  reference: string;
  userId: string;
  method: BookingMethod;
  singleResourceKind: SingleResourceKind | null;
  status: BookingStatus;
  startDate: string;
  endDate: string | null;
  totalUsd: number;
  subtotalUsd: number;
  discountUsd: number;
  expiresAt: string;
  cancelledAt: string | null;
  refundPercentage: number | null;
  qrCodeUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
