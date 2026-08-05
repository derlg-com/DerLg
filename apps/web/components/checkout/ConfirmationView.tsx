'use client';

import Link from 'next/link';

import { useBooking } from '@/hooks/use-bookings';
import { useTranslations } from '@/lib/i18n';
import { formatCents } from '@/lib/utils';
import type { Booking } from '@/types/booking';

/** Builds an .ics file in the browser — no server round trip, no extra library. */
function calendarHref(booking: Booking): string {
  const stamp = (date: string) => `${date.replace(/-/g, '')}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DerLg//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${booking.reference}@derlg.com`,
    `DTSTART;VALUE=DATE:${stamp(booking.startDate)}`,
    `DTEND;VALUE=DATE:${stamp(booking.endDate)}`,
    `SUMMARY:${booking.snapshot.title}`,
    `DESCRIPTION:DerLg booking ${booking.reference}${
      booking.checkInCode ? ` — check-in code ${booking.checkInCode}` : ''
    }`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
}

function receiptHref(booking: Booking): string {
  const lines = [
    `DerLg receipt — ${booking.reference}`,
    ''.padEnd(40, '='),
    `Trip: ${booking.snapshot.title}`,
    `Dates: ${booking.startDate} to ${booking.endDate}`,
    `Travellers: ${booking.guests}`,
    '',
    ...booking.snapshot.price.lines.map(
      (line) =>
        `${line.label} x${line.quantity} ... ${formatCents(line.totalCents)}`,
    ),
    ''.padEnd(40, '-'),
    `Total paid: ${formatCents(booking.totalCents)} ${booking.currency}`,
    booking.checkInCode ? `Check-in code: ${booking.checkInCode}` : '',
    '',
    'Thank you for travelling with DerLg.',
  ];
  return `data:text/plain;charset=utf-8,${encodeURIComponent(lines.join('\n'))}`;
}

export function ConfirmationView({ bookingId }: { bookingId: string }) {
  const t = useTranslations('checkout');
  const tb = useTranslations('bookings');
  // While Stripe's webhook lands, the booking is still PENDING_PAYMENT; polling
  // is already built into useBooking for that state.
  const booking = useBooking(bookingId);

  if (booking.isLoading) {
    return (
      <p className="px-6 py-16 text-ink-500" role="status">
        {t('loading')}
      </p>
    );
  }

  if (!booking.data) {
    return (
      <p className="px-6 py-16 text-center text-ink-700" role="alert">
        {tb('notFound')}
      </p>
    );
  }

  const data = booking.data;

  if (data.status !== 'CONFIRMED') {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-3 px-6 py-16 text-center">
        <p className="font-medium text-ink-800" role="status" data-testid="awaiting-confirmation">
          {t('waitingForConfirmation')}
        </p>
        <p className="text-sm text-ink-600">{t('waitingHint')}</p>
        <Link href={`/bookings/${data.id}`} className="text-sm font-medium text-brand-700 underline">
          {t('viewBooking')}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-4xl" aria-hidden="true">
          ✓
        </p>
        <h1 className="text-2xl font-semibold text-ink-900">{t('confirmedTitle')}</h1>
        <p className="text-sm text-ink-600">{t('confirmedBody', { email: data.contactEmail })}</p>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            {t('confirmedReference')}
          </span>
          <span className="text-lg font-semibold text-emerald-900" data-testid="confirmation-reference">
            {data.reference}
          </span>
        </div>

        {data.checkInCode ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              {t('confirmedCheckIn')}
            </span>
            <span
              className="text-2xl font-semibold tracking-widest text-emerald-900"
              data-testid="confirmation-check-in"
            >
              {data.checkInCode}
            </span>
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            {t('confirmedTotal')}
          </span>
          <span className="text-lg font-semibold tabular-nums text-emerald-900">
            {formatCents(data.totalCents)}
          </span>
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <Link
          href={`/bookings/${data.id}`}
          className="rounded-full bg-brand-600 px-5 py-3 text-center font-medium text-white hover:bg-brand-700"
        >
          {t('viewBooking')}
        </Link>
        <a
          href={receiptHref(data)}
          download={`derlg-receipt-${data.reference}.txt`}
          className="rounded-full border border-ink-300 px-5 py-2.5 text-center text-sm font-medium text-ink-800 hover:bg-ink-100"
        >
          {t('downloadReceipt')}
        </a>
        <a
          href={calendarHref(data)}
          download={`derlg-${data.reference}.ics`}
          className="rounded-full px-5 py-2.5 text-center text-sm font-medium text-brand-700 hover:bg-brand-50"
        >
          {t('addToCalendar')}
        </a>
      </div>
    </main>
  );
}
