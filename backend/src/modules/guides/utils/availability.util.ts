import type { BusyRange } from '../interfaces/availability.interface';

export type BookingItemDate = {
  date: Date;
};

/** Force-UTC next-day helper — safe on any server timezone. */
function nextDay(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Pure function. Converts a list of confirmed booking item dates into
 * merged busy ranges within the requested [from, to) window.
 * Each BookingItem.date represents one booked day.
 */
export function buildBusyRanges(
  items: BookingItemDate[],
  from: Date,
  to: Date,
): BusyRange[] {
  if (items.length === 0) return [];

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  // Collect unique booked days within range, sorted ascending
  const days = Array.from(
    new Set(
      items
        .map((i) => i.date.toISOString().slice(0, 10))
        .filter((d) => d >= fromStr && d < toStr),
    ),
  ).sort();

  if (days.length === 0) return [];

  // Merge consecutive days into ranges
  const ranges: BusyRange[] = [];
  let rangeStart = days[0];
  let rangeEnd = days[0];

  for (let i = 1; i < days.length; i++) {
    if (days[i] === nextDay(rangeEnd)) {
      rangeEnd = days[i];
    } else {
      ranges.push({ from: rangeStart, to: rangeEnd });
      rangeStart = days[i];
      rangeEnd = days[i];
    }
  }
  ranges.push({ from: rangeStart, to: rangeEnd });

  return ranges;
}
