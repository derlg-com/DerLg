/**
 * Pure function. Returns true if a booking item overlaps the requested date range.
 * BookingItem.date is the check-in date; the booking spans [date, date + (endDate - startDate)).
 * For simplicity, overlap is detected when bookingDate is within [checkIn, checkOut).
 */
export function doesBookingOverlap(
  bookingDate: Date,
  checkIn: Date,
  checkOut: Date,
): boolean {
  return bookingDate >= checkIn && bookingDate < checkOut;
}

export type BookingItemSlim = {
  hotelRoomId: string | null;
  date: Date;
};

/**
 * Given the room IDs that have confirmed bookings, return the set of overlapping room IDs.
 */
export function overlappingRoomIds(
  bookingItems: BookingItemSlim[],
  checkIn: Date,
  checkOut: Date,
): Set<string> {
  const result = new Set<string>();
  for (const item of bookingItems) {
    if (item.hotelRoomId && doesBookingOverlap(item.date, checkIn, checkOut)) {
      result.add(item.hotelRoomId);
    }
  }
  return result;
}
