import { BookingStatus, ItemType } from '@prisma/client';

import type { PriceLine } from '../../availability/interfaces/availability.interface';
import type { DraftDay } from '../../journeys/interfaces/journey-draft.interface';

/** Hold window for unpaid bookings. */
export const HOLD_DURATION_SECONDS = 15 * 60;

/** Redis key holding the countdown for a booking. Its TTL is the source of truth for "is this hold still warm". */
export function holdKey(bookingId: string): string {
  return `booking:hold:${bookingId}`;
}

/**
 * Frozen copy of the itinerary at the moment of booking. Catalogue or draft
 * edits afterwards never change what the traveller agreed to pay for.
 */
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
    lines: PriceLine[];
  };
}

export interface BookingItemView {
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

export interface BookingView {
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
  holdExpiresAt: Date | null;
  /** Null unless the booking is still holding inventory; 0 means it has lapsed. */
  secondsRemaining: number | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  snapshot: BookingSnapshot;
  items: BookingItemView[];
  payment: {
    id: string;
    status: string;
    amountCents: number;
    currency: string;
    provider: string;
    refundedCents: number;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Statuses from which a traveller may still cancel. */
export const CANCELLABLE_STATUSES: BookingStatus[] = [
  BookingStatus.HOLD,
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
];

/**
 * Human-facing booking reference: DLG-YYYY-NNNN.
 * The sequence is per-year and derived from a Postgres sequence-like count, so
 * references stay short and readable rather than exposing a uuid.
 */
export function formatReference(year: number, sequence: number): string {
  return `DLG-${year}-${String(sequence).padStart(4, '0')}`;
}
