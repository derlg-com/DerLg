'use client';

import Link from 'next/link';

import { BookingStatusBadge } from '@/components/bookings/BookingStatusBadge';
import { HoldCountdown } from '@/components/bookings/HoldCountdown';
import { Button } from '@/components/ui/Button';
import { useBooking, useCancelBooking, useHoldCountdown } from '@/hooks/use-bookings';
import { useTranslations } from '@/lib/i18n';
import { formatCents } from '@/lib/utils';

export function BookingDetailView({ bookingId }: { bookingId: string }) {
  const t = useTranslations('bookings');
  const booking = useBooking(bookingId);
  const cancel = useCancelBooking(bookingId);
  const seconds = useHoldCountdown(booking.data);

  if (booking.isLoading) {
    return (
      <p className="px-6 py-16 text-ink-500" role="status">
        {t('holding')}
      </p>
    );
  }

  if (booking.isError || !booking.data) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 px-6 py-16 text-center">
        <p role="alert" className="text-ink-700">
          {t('notFound')}
        </p>
        <Link href="/bookings" className="text-sm font-medium text-brand-700 underline">
          {t('backToBookings')}
        </Link>
      </div>
    );
  }

  const data = booking.data;
  const isHolding = data.status === 'HOLD' || data.status === 'PENDING_PAYMENT';

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3">
        <Link href="/bookings" className="text-sm text-brand-700 hover:underline">
          ← {t('backToBookings')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink-900">{data.snapshot.title}</h1>
          <BookingStatusBadge status={data.status} />
        </div>
        <p className="text-sm text-ink-600">
          {t('reference')} <span className="font-medium text-ink-900">{data.reference}</span> ·{' '}
          {t('dates', { start: data.startDate, end: data.endDate })} ·{' '}
          {t('guests', { count: data.guests })}
        </p>
      </header>

      {isHolding ? <HoldCountdown seconds={seconds} /> : null}

      {data.status === 'CONFIRMED' && data.checkInCode ? (
        <section className="flex flex-col gap-1 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
            {t('checkInCode')}
          </h2>
          <p className="text-2xl font-semibold tracking-widest text-emerald-900" data-testid="check-in-code">
            {data.checkInCode}
          </p>
          <p className="text-xs text-emerald-800">{t('confirmedNote')}</p>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl border border-ink-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          {t('priceBreakdown')}
        </h2>
        <ul className="flex flex-col gap-1 text-sm text-ink-600">
          {data.snapshot.price.baseCents > 0 ? (
            <li className="flex justify-between">
              <span>Package base</span>
              <span className="tabular-nums">{formatCents(data.snapshot.price.baseCents)}</span>
            </li>
          ) : null}
          {data.snapshot.price.deltaCents !== 0 ? (
            <li className="flex justify-between">
              <span>Your changes</span>
              <span className="tabular-nums">
                {data.snapshot.price.deltaCents > 0 ? '+' : '−'}
                {formatCents(Math.abs(data.snapshot.price.deltaCents))}
              </span>
            </li>
          ) : null}
          <li className="mt-1 flex justify-between border-t border-ink-100 pt-2 text-base font-semibold text-ink-900">
            <span>{t('total')}</span>
            <span className="tabular-nums" data-testid="booking-total">
              {formatCents(data.totalCents)}
            </span>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-ink-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          {t('itinerary')}
        </h2>
        <ol className="flex flex-col gap-4">
          {data.snapshot.days.map((day) => (
            <li key={day.dayKey} className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-ink-900">
                Day {day.dayNumber} — {day.title}
              </p>
              <ul className="flex flex-col gap-0.5 pl-3 text-sm text-ink-600">
                {day.items.map((item) => (
                  <li key={item.itemKey} className="flex gap-2">
                    <span className="w-12 shrink-0 tabular-nums text-ink-500">
                      {item.startTime ?? '—'}
                    </span>
                    <span>{item.title}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink-200 bg-white p-5 text-sm text-ink-600">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          {t('contact')}
        </h2>
        <p>{data.contactName}</p>
        <p>{data.contactEmail}</p>
      </section>

      <div className="flex flex-wrap gap-3">
        {isHolding ? (
          <Link
            href={`/checkout/${data.id}`}
            className="rounded-full bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
          >
            {t('payNow')}
          </Link>
        ) : null}

        {['HOLD', 'PENDING_PAYMENT', 'CONFIRMED'].includes(data.status) ? (
          <Button
            variant="secondary"
            disabled={cancel.isPending}
            onClick={() => {
              if (window.confirm(t('cancelConfirm', { reference: data.reference }))) {
                cancel.mutate();
              }
            }}
          >
            {cancel.isPending ? t('cancelling') : t('cancelBooking')}
          </Button>
        ) : null}
      </div>

      {cancel.isError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {t('cancelError')}
        </p>
      ) : null}
    </main>
  );
}
