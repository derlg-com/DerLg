/**
 * Half-open interval-overlap predicate.
 *
 * Two ranges overlap iff `a.start < b.end && a.end > b.start`.
 * Adjacent ranges (a.end === b.start) do NOT overlap — leaves room for
 * back-to-back bookings.
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export function checkOverlap(
  existing: DateRange[],
  target: DateRange,
): boolean {
  if (target.startDate > target.endDate) {
    throw new Error(
      `checkOverlap: target.startDate (${target.startDate.toISOString()}) is after target.endDate (${target.endDate.toISOString()})`,
    );
  }

  return existing.some(
    (r) => r.startDate < target.endDate && r.endDate > target.startDate,
  );
}
