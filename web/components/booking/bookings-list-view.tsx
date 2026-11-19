'use client'

import { ArrowRight, Calendar, Compass, MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { RequireAuth } from '@/components/auth/require-auth'
import { StatusBadge } from '@/components/booking/checkout-view'
import { Price } from '@/components/shared/price'
import {
  Card,
  ErrorState,
  Skeleton,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  buttonVariants,
} from '@/components/ui'
import { useBookings } from '@/hooks/use-bookings'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/i18n/navigation'
import { isAwaitingPayment, type Booking } from '@/schemas/booking'

export function BookingsListView() {
  return (
    <RequireAuth>
      <BookingsListBody />
    </RequireAuth>
  )
}

function BookingsListBody() {
  const t = useTranslations('bookings.list')
  const bookingsQuery = useBookings({ limit: 50 })

  if (bookingsQuery.isPending) {
    return (
      <div className="space-y-4 px-4 py-6">
        <Skeleton className="h-8 w-48 rounded-full" />
        <div className="space-y-3">
          <Skeleton className="h-36 w-full rounded-[24px]" />
          <Skeleton className="h-36 w-full rounded-[24px]" />
          <Skeleton className="h-36 w-full rounded-[24px]" />
        </div>
      </div>
    )
  }

  if (bookingsQuery.isError) {
    return (
      <div className="px-4 py-8">
        <ErrorState
          title={t('errorTitle')}
          description={t('errorDesc')}
          onRetry={() => bookingsQuery.refetch()}
          retryLabel={t('retry')}
        />
      </div>
    )
  }

  const allBookings = bookingsQuery.data?.items ?? []
  const today = new Date().setHours(0, 0, 0, 0)

  const upcomingBookings = allBookings.filter((b) => {
    if (b.status === 'HOLD' || b.status === 'PENDING_PAYMENT') return true
    if (b.status === 'CONFIRMED') {
      const end = b.endDate
        ? new Date(b.endDate).getTime()
        : b.startDate
          ? new Date(b.startDate).getTime()
          : NaN
      return isNaN(end) || end >= today
    }
    return false
  })

  const pastBookings = allBookings.filter((b) => {
    if (b.status === 'COMPLETED') return true
    if (b.status === 'CONFIRMED') {
      const end = b.endDate
        ? new Date(b.endDate).getTime()
        : b.startDate
          ? new Date(b.startDate).getTime()
          : NaN
      return !isNaN(end) && end < today
    }
    return false
  })

  const cancelledBookings = allBookings.filter((b) => {
    return (
      b.status === 'CANCELLED' ||
      b.status === 'EXPIRED' ||
      b.status === 'PAYMENT_FAILED' ||
      b.status === 'NO_SHOW'
    )
  })

  return (
    <div className="space-y-5 px-4 py-4 sm:px-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-navel-jade)]">
          My Journeys
        </span>
        <h1 className="font-dela text-2xl font-bold tracking-tight text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
          {t('title')}
        </h1>
      </div>

      <Tabs defaultValue="upcoming" className="mt-4">
        <TabList label={t('title')}>
          <Tab value="upcoming">
            {t('tabs.upcoming')} ({upcomingBookings.length})
          </Tab>
          <Tab value="past">
            {t('tabs.past')} ({pastBookings.length})
          </Tab>
          <Tab value="cancelled">
            {t('tabs.cancelled')} ({cancelledBookings.length})
          </Tab>
        </TabList>

        <TabPanel value="upcoming" className="mt-4">
          <BookingSection bookings={upcomingBookings} emptyMessage={t('empty.upcoming')} />
        </TabPanel>

        <TabPanel value="past" className="mt-4">
          <BookingSection bookings={pastBookings} emptyMessage={t('empty.past')} />
        </TabPanel>

        <TabPanel value="cancelled" className="mt-4">
          <BookingSection bookings={cancelledBookings} emptyMessage={t('empty.cancelled')} />
        </TabPanel>
      </Tabs>
    </div>
  )
}

function BookingSection({
  bookings,
  emptyMessage,
}: {
  bookings: Booking[]
  emptyMessage: string
}) {
  const t = useTranslations('bookings.list')

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-[var(--color-navel-cream)] dark:bg-[var(--surface-sunken)] text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)] mb-4 shadow-sm">
          <Compass className="size-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
          {emptyMessage}
        </h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-xs mb-4">
          Plan your next adventure with DerLg today.
        </p>
        <Link
          href="/trips"
          className={cn(buttonVariants({ variant: 'navelPrimary', size: 'sm' }))}
        >
          {t('explore')}
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {bookings.map((booking) => (
        <BookingCard key={booking.id} booking={booking} />
      ))}
    </div>
  )
}

/**
 * NAVEL `Card/Booking` (315x150)
 */
function BookingCard({ booking }: { booking: Booking }) {
  const tDetail = useTranslations('bookings.detail')
  const awaitingPayment = isAwaitingPayment(booking.status)

  return (
    <Card className="overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface)] dark:bg-[var(--surface-sunken)] p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-[var(--text-tertiary)] bg-[var(--color-navel-cream)]/80 dark:bg-[var(--surface)] px-2 py-0.5 rounded-md">
              {booking.reference}
            </span>
            <StatusBadge status={booking.status} />
          </div>

          <h2 className="mt-2 truncate text-base font-bold text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
            {booking.name ?? booking.reference}
          </h2>

          {booking.location ? (
            <div className="mt-1 flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <MapPin className="size-3 text-[var(--color-navel-gold)] shrink-0" />
              <span className="truncate">{booking.location}</span>
            </div>
          ) : null}

          {booking.startDate ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-tertiary)]">
              <Calendar className="size-3 text-[var(--color-navel-jade)] shrink-0" />
              <span>
                {formatDate(booking.startDate)}
                {booking.endDate && booking.endDate !== booking.startDate
                  ? ` – ${formatDate(booking.endDate)}`
                  : null}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-end justify-between self-stretch text-right">
          <p className="text-base font-extrabold text-[var(--color-navel-forest)] dark:text-[var(--color-navel-gold)]">
            <Price amountUsd={booking.totalPriceUsd} />
          </p>

          <Link
            href={`/bookings/${booking.id}`}
            className={cn(
              buttonVariants({
                variant: awaitingPayment ? 'navelPrimary' : 'navelSecondary',
                size: 'sm',
              }),
              'rounded-full px-3.5',
            )}
          >
            <span>{awaitingPayment ? tDetail('payNow') : tDetail('reference')}</span>
            <ArrowRight className="size-3.5 ml-1" />
          </Link>
        </div>
      </div>
    </Card>
  )
}

function formatDate(value: string): string {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Date(parsed).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
