'use client';

import Link from 'next/link';

import { BookingStatusBadge } from '@/components/bookings/BookingStatusBadge';
import { HoldCountdown } from '@/components/bookings/HoldCountdown';
import { useBookings, useHoldCountdown } from '@/hooks/use-bookings';
import { useTranslations } from '@/lib/i18n';
import { formatCents } from '@/lib/utils';
import type { Booking } from '@/types/booking';

function BookingRow({ booking }: { booking: Booking }) {
  const t = useTranslations('bookings');
  const seconds = useHoldCountdown(booking);

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-ink-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-ink-900">{booking.snapshot.title}</h2>
            <BookingStatusBadge status={booking.status} />
          </div>
          <p className="text-sm text-ink-600">
            {t('reference')} {booking.reference}
          </p>
          <p className="text-sm text-ink-600">
            {t('dates', { start: booking.startDate, end: booking.endDate })} ·{' '}
            {t('guests', { count: booking.guests })}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <p className="text-xl font-semibold tabular-nums text-ink-900">
            {formatCents(booking.totalCents)}
          </p>
          <Link
            href={`/bookings/${booking.id}`}
            className="rounded-full border border-ink-300 px-4 py-2 text-sm font-medium text-ink-800 hover:bg-ink-100"
          >
            {t('viewDetails')}
          </Link>
        </div>
      </div>

      {booking.status === 'HOLD' || booking.status === 'PENDING_PAYMENT' ? (
        <HoldCountdown seconds={seconds} />
      ) : null}
    </li>
  );
}

export function BookingsList() {
  const t = useTranslations('bookings');
  const bookings = useBookings();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-ink-900">{t('listTitle')}</h1>
        <p className="text-ink-600">{t('listBody')}</p>
      </header>

      {bookings.isLoading ? (
        <p className="text-ink-500" role="status">
          {t('holding')}
        </p>
      ) : bookings.isError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {t('loadError')}
        </p>
      ) : (bookings.data?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-ink-200 bg-white p-8 text-center">
          <p className="font-medium text-ink-800">{t('empty')}</p>
          <p className="mt-1 text-sm text-ink-600">{t('emptyHint')}</p>
          <Link
            href="/packages"
            className="mt-4 inline-block rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t('browseCta')}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {bookings.data?.map((booking) => (
            <BookingRow key={booking.id} booking={booking} />
          ))}
        </ul>
      )}
    </main>
  );
}
