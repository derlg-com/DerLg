import type { ItemType } from './catalog';

/** Mirrors the API's DraftView (apps/api/.../journey-draft.interface.ts). */

export interface DraftItem {
  itemKey: string;
  type: ItemType;
  refId: string | null;
  title: string;
  description: string;
  startTime: string | null;
  durationMinutes: number;
  extraPriceCents: number;
  bookable: boolean;
  unitPriceCents: number;
  referenceLabel: string | null;
}

export interface DraftDay {
  dayKey: string;
  dayNumber: number;
  title: string;
  summary: string;
  items: DraftItem[];
}

export interface DraftPriceLine {
  dayNumber: number;
  type: ItemType;
  refId: string | null;
  label: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface DraftAvailabilityItem {
  itemKey?: string;
  dayNumber: number;
  date: string;
  available: boolean;
  reason?: string;
  remaining: number | null;
  alternatives: Array<{ refId: string; slug: string; label: string; priceCents: number }>;
}

export interface DraftView {
  id: string;
  title: string;
  source: 'MANUAL' | 'AI';
  packageId: string | null;
  packageSlug: string | null;
  startDate: string | null;
  guests: number;
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
  availability?: {
    available: boolean;
    unavailableCount: number;
    items: DraftAvailabilityItem[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface DraftItemInput {
  type: ItemType;
  refId?: string;
  title: string;
  description?: string;
  startTime?: string;
  durationMinutes?: number;
  extraPriceCents?: number;
}

/** The named operations the PATCH endpoint accepts. */
export type DraftOperation =
  | { op: 'reorder_days'; dayKeys: string[] }
  | { op: 'add_day'; title?: string; summary?: string; position?: number }
  | { op: 'remove_day'; dayKey: string; confirmRemoval?: boolean }
  | { op: 'update_day'; dayKey: string; title?: string; summary?: string }
  | { op: 'add_item'; dayKey: string; item: DraftItemInput; position?: number }
  | { op: 'remove_item'; itemKey: string }
  | { op: 'replace_item'; itemKey: string; item: DraftItemInput }
  | { op: 'move_item'; itemKey: string; toDayKey: string; position?: number }
  | { op: 'set_guests'; guests: number }
  | { op: 'set_start_date'; startDate?: string }
  | { op: 'set_title'; title: string };
