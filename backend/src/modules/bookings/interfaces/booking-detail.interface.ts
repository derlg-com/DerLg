import type { BookingType } from '@prisma/client';
import type { Booking } from './booking.interface';

export interface BookingItem {
  id: string;
  bookingType: BookingType;
  resourceId: string | null;
  startDate: string;
  endDate: string;
  quantity: number;
  unitPriceUsd: number;
  subtotalUsd: number;
  snapshot: unknown;
}

/** Booking detail view — booking + populated items[]. */
export interface BookingDetail extends Booking {
  items: BookingItem[];
}
