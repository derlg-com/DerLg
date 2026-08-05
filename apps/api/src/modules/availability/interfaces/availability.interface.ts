import { ItemType } from '@prisma/client';

/**
 * Shared vocabulary for pricing and availability. Both the manual customize
 * flow (Tasks 9/10) and the AI tools (Tasks 14/16) speak this language, so a
 * price quoted in chat and a price quoted in the editor come from one code path.
 */

/** One bookable (or free) line of an itinerary, independent of where it came from. */
export interface PriceableItem {
  dayNumber: number;
  type: ItemType;
  /** Polymorphic catalogue id; null for CUSTOM / free-form items. */
  refId: string | null;
  title: string;
  bookable: boolean;
  /** Extra charge on top of the referenced resource's own price, in cents. */
  extraPriceCents?: number;
  /** Overrides the derived quantity (e.g. two rooms instead of one). */
  quantity?: number;
}

export interface PriceLine {
  dayNumber: number;
  type: ItemType;
  refId: string | null;
  label: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface PriceQuote {
  guests: number;
  /** Package base price for this party size; 0 for a from-scratch journey. */
  baseCents: number;
  /** Cost of the items actually in the itinerary. */
  itemsCents: number;
  /** Cost of the original template's items, used to compute the delta. */
  templateItemsCents: number;
  /** itemsCents - templateItemsCents: what customisation has added or saved. */
  deltaCents: number;
  totalCents: number;
  currency: 'USD';
  lines: PriceLine[];
}

export interface AvailabilityRequestItem extends PriceableItem {
  /** Stable client-side id so the response can be matched back to the row. */
  itemKey?: string;
}

export interface AvailabilityAlternative {
  refId: string;
  slug: string;
  label: string;
  priceCents: number;
  remaining: number;
}

export interface AvailabilityItemResult {
  itemKey?: string;
  dayNumber: number;
  date: string;
  type: ItemType;
  refId: string | null;
  label: string;
  requested: number;
  capacity: number | null;
  alreadyBooked: number;
  remaining: number | null;
  available: boolean;
  reason?: 'MISSING_REFERENCE' | 'SOLD_OUT' | 'CAPACITY_EXCEEDED';
  alternatives: AvailabilityAlternative[];
}

export interface AvailabilityReport {
  startDate: string;
  endDate: string;
  guests: number;
  available: boolean;
  items: AvailabilityItemResult[];
  unavailableCount: number;
}

/** Statuses that hold inventory. EXPIRED and CANCELLED release it. */
export const INVENTORY_HOLDING_STATUSES = ['HOLD', 'PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED'] as const;

/**
 * How many units of a resource one itinerary line consumes.
 * Hotels are priced per room at double occupancy; guides are one per day
 * regardless of party size; everything else is per traveller.
 */
export function unitsFor(type: ItemType, guests: number): number {
  switch (type) {
    case ItemType.PLACE:
    case ItemType.TRANSPORT:
      return guests;
    case ItemType.HOTEL:
      return Math.ceil(guests / 2);
    case ItemType.GUIDE:
      return 1;
    default:
      return 0;
  }
}

/** Adds whole days to a date without tripping over daylight saving. */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** `YYYY-MM-DD` in UTC — the form used by Postgres `date` columns. */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
