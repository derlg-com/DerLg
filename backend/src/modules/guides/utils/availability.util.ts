import type { BusyRange } from '../interfaces/availability.interface';

export type BookingItemDate = {
  startDate: Date;
  endDate: Date;
};

/** Force-UTC next-day helper — safe on any server timezone. */
function nextDay(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Pure function. Converts a list of confirmed booking item intervals into
 * merged busy ranges within the requested [from, to) window.
 * Each BookingItem spans [startDate, endDate] (inclusive on both ends).
 */
export function buildBusyRanges(
  items: BookingItemDate[],
  from: Date,
  to: Date,
): BusyRange[] {
  if (items.length === 0) return [];

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  // Expand each item's interval into its set of days, clipped to [from, to)
  const days = new Set<string>();
  for (const item of items) {
    const cursor = new Date(item.startDate.getTime());
    const end = new Date(item.endDate.getTime());
    while (cursor <= end) {
      const d = cursor.toISOString().slice(0, 10);
      if (d >= fromStr && d < toStr) days.add(d);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const sorted = Array.from(days).sort();
  if (sorted.length === 0) return [];

  // Merge consecutive days into ranges
  const ranges: BusyRange[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === nextDay(rangeEnd)) {
      rangeEnd = sorted[i];
    } else {
      ranges.push({ from: rangeStart, to: rangeEnd });
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
    }
  }
  ranges.push({ from: rangeStart, to: rangeEnd });

  return ranges;
}
