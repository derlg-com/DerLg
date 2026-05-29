import type { Booking, BookingItem } from '@prisma/client';

const CRLF = '\r\n';

const dateStamp = (d: Date): string =>
  d.toISOString().slice(0, 10).replace(/-/g, '');

/**
 * Produces an RFC 5545 VCALENDAR string from a Booking + its items.
 * Single VEVENT spanning the booking's window. CRLF terminators are required
 * by the spec so calendar clients parse the body correctly.
 */
export function buildIcal(
  booking: Booking,
  items: BookingItem[],
  summary = `Booking ${booking.reference}`,
): string {
  const start = booking.startDate;
  const end = booking.endDate ?? booking.startDate;
  const description = items
    .map((i) => `Item ${i.id} (${i.bookingType})`)
    .join(' / ');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DerLg//Booking//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${booking.reference}@derlg`,
    `DTSTAMP:${dateStamp(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${dateStamp(start)}`,
    `DTEND;VALUE=DATE:${dateStamp(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join(CRLF);
}
