import type { ItemType } from './catalog';
import type { DraftDay, DraftPriceLine } from './journey';

export type BookingStatus =
  | 'HOLD'
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'COMPLETED';

export interface BookingItem {
  id: string;
  dayNumber: number;
  type: ItemType;
  refId: string | null;
  title: string;
  date: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  bookable: boolean;
}

export interface BookingSnapshot {
  title: string;
  packageSlug: string | null;
  days: DraftDay[];
  price: {
    baseCents: number;
    itemsCents: number;
    templateItemsCents: number;
    deltaCents: number;
    totalCents: number;
    currency: 'USD';
    lines: DraftPriceLine[];
  };
}

export interface Booking {
  id: string;
  reference: string;
  status: BookingStatus;
  startDate: string;
  endDate: string;
  guests: number;
  totalCents: number;
  currency: string;
  contactName: string;
  contactEmail: string;
  packageId: string | null;
  packageSlug: string | null;
  draftId: string | null;
  checkInCode: string | null;
  holdExpiresAt: string | null;
  secondsRemaining: number | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  snapshot: BookingSnapshot;
  items: BookingItem[];
  payment: {
    id: string;
    status: string;
    amountCents: number;
    currency: string;
    provider: string;
    refundedCents: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingInput {
  draftId?: string;
  packageId?: string;
  packageSlug?: string;
  startDate?: string;
  guests?: number;
  contactName: string;
  contactEmail: string;
}
