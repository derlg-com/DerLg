import { ItemType } from '@prisma/client';

import type { PriceLine, PriceQuote } from '../../availability/interfaces/availability.interface';

/**
 * A draft's `snapshot` column holds this shape: the full priced day/item tree at
 * the moment it was last saved. Catalogue edits after that point never mutate a
 * traveller's plan — the snapshot is the contract, and a booking freezes a copy
 * of it again (Task 11).
 */

export interface DraftItem {
  /** Stable id so the editor can reorder/remove without server round-trips. */
  itemKey: string;
  type: ItemType;
  /** Polymorphic catalogue id; null for CUSTOM free-form entries. */
  refId: string | null;
  title: string;
  description: string;
  startTime: string | null;
  durationMinutes: number;
  extraPriceCents: number;
  bookable: boolean;
  /** Denormalised for display; recomputed on every save from the catalogue. */
  unitPriceCents: number;
  /** Resolved catalogue label, e.g. the hotel's real name. */
  referenceLabel: string | null;
}

export interface DraftDay {
  dayKey: string;
  dayNumber: number;
  title: string;
  summary: string;
  items: DraftItem[];
}

export interface DraftSnapshot {
  days: DraftDay[];
  /** The template the draft started from, kept for the customisation delta. */
  templateItems: Array<{
    dayNumber: number;
    type: ItemType;
    refId: string | null;
    title: string;
    bookable: boolean;
    extraPriceCents: number;
  }>;
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
    lines: PriceLine[];
  };
  /** Present when the draft has a start date and could be checked. */
  availability?: {
    available: boolean;
    unavailableCount: number;
    items: Array<{
      itemKey?: string;
      dayNumber: number;
      date: string;
      available: boolean;
      reason?: string;
      remaining: number | null;
      alternatives: Array<{ refId: string; slug: string; label: string; priceCents: number }>;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type PricedQuote = PriceQuote;
