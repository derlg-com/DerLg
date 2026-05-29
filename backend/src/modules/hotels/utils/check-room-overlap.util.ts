/**
 * Pure function. Returns true if a booking item interval overlaps the requested check-in/out range.
 * Half-open semantics: [itemStart, itemEnd] overlaps [checkIn, checkOut) iff
 *   itemStart < checkOut AND itemEnd >= checkIn.
 */
export function doesBookingOverlap(
  itemStart: Date,
  itemEnd: Date,
  checkIn: Date,
  checkOut: Date,
): boolean {
  return itemStart < checkOut && itemEnd >= checkIn;
}

export type BookingItemSlim = {
  hotelRoomId: string | null;
  startDate: Date;
  endDate: Date;
};

/**
 * Given the booking items confirmed for a hotel, return the set of room IDs
 * whose intervals overlap the requested [checkIn, checkOut) window.
 */
export function overlappingRoomIds(
  bookingItems: BookingItemSlim[],
  checkIn: Date,
  checkOut: Date,
): Set<string> {
  const result = new Set<string>();
  for (const item of bookingItems) {
    if (
      item.hotelRoomId &&
      doesBookingOverlap(item.startDate, item.endDate, checkIn, checkOut)
    ) {
      result.add(item.hotelRoomId);
    }
  }
  return result;
}
