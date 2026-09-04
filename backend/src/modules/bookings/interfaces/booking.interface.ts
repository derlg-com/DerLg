import type { BookingMethod, SingleResourceKind } from '@prisma/client';

/**
 * Public Booking summary (used by list endpoints + nested in BookingDetail).
 * Mirrors the frontend contract in `frontend/types/api.ts` (UnifiedBooking +
 * the detail extras), with internal fields retained for back-compat.
 */
export interface Booking {
  id: string;
  reference: string;
  /** 'trip' | 'hotel' | 'guide' | 'transportation' */
  type: string;
  name: string;
  coverImageUrl: string | null;
  /** Human-readable location label derived from the primary item snapshot, or null. */
  location: string | null;
  startDate: string;
  endDate: string | null;
  /** UPPERCASE booking status (HOLD | PENDING_PAYMENT | CONFIRMED | …). */
  status: string;
  totalPriceUsd: number;
  holdExpiresAt: string;
  specialRequests: string | null;
  refundAmountUsd: number | null;
  cancelledAt: string | null;

  // Internal / back-compat fields (not part of the documented frontend shape).
  userId: string;
  method: BookingMethod;
  singleResourceKind: SingleResourceKind | null;
  tripTemplateId: string | null;
  subtotalUsd: number;
  discountUsd: number;
  refundPercentage: number | null;
  qrCodeUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
