'use client'

import Link from 'next/link'
import { CheckCircle2, Clock, Download, Ticket } from 'lucide-react'
import { BookingShell } from '@/components/booking/BookingShell'
import { PaymentReceipt } from './PaymentReceipt'
import { NextSteps } from './NextSteps'
import { SupportInfo } from './SupportInfo'
import { GuideContactCard } from './GuideContactCard'
import { AddToCalendarButton } from '@/components/bookings/AddToCalendarButton'
import { ShareButton } from '@/components/shared/ShareButton'
import { BookingQrCode } from '@/components/bookings/BookingQrCode'
import { useApiQuery } from '@/lib/use-api-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { bookingHasReceipt, deriveReceipt } from '@/lib/receipt'
import { formatDateShort } from '@/lib/format'
import { useCurrency } from '@/hooks/use-currency'
import type { BookingDetail } from '@/types/api'

function Inner({ bookingId }: { bookingId: string }) {
  const t = useTranslations('checkout')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const {
    data: booking,
    isLoading,
    error,
    refetch,
  } = useApiQuery<BookingDetail>(`/v1/bookings/${bookingId}`)

  // Loading: keep the page structure stable with a skeleton while the booking loads.
  if (isLoading) {
    return (
      <div className="mx-auto max-w-md space-y-5 px-4 py-12" aria-busy="true">
        <span className="sr-only">{t('confirmation.loading')}</span>
        <Skeleton className="mx-auto h-20 w-20 rounded-full" />
        <Skeleton className="mx-auto h-8 w-2/3" />
        <Skeleton className="mx-auto h-4 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  // Not found / load error: don't show a success state for a booking we can't load.
  if (error || !booking) {
    const notFound = error?.status === 404 || !booking
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <EmptyState
          icon={Ticket}
          title={notFound ? t('confirmation.notFoundTitle') : t('confirmation.errorTitle')}
          description={notFound ? t('confirmation.notFoundDesc') : t('confirmation.errorDesc')}
          action={
            notFound ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/bookings">{t('confirmation.viewBooking')}</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={refetch}>
                {t('confirmation.retry')}
              </Button>
            )
          }
        />
      </div>
    )
  }

  const isConfirmed = booking.status === 'CONFIRMED' || booking.status === 'COMPLETED'

  // Reached the confirmation page but payment hasn't completed (e.g. landed here
  // before checkout finished, or a HOLD/PENDING_PAYMENT booking). Guide the user
  // back to checkout rather than implying success.
  if (!isConfirmed) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <EmptyState
          icon={Clock}
          title={t('confirmation.pendingTitle')}
          description={t('confirmation.pendingDesc')}
          action={
            <Button asChild variant="gradient" size="sm">
              <Link href={`/checkout/${bookingId}`}>{t('confirmation.completePayment')}</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const receipt = bookingHasReceipt(booking) ? deriveReceipt(booking, { currency }) : null
  const dateRange =
    booking.endDate && booking.endDate !== booking.startDate
      ? `${formatDateShort(booking.startDate, locale)} – ${formatDateShort(booking.endDate, locale)}`
      : formatDateShort(booking.startDate, locale)

  // "Download confirmation" (Requirement 39.4) uses the browser's native
  // print-to-PDF. Action buttons / page chrome are marked `print-hidden`
  // (see app/globals.css) so the saved PDF contains only the confirmation
  // document (details, receipt, next steps). Works offline — no extra deps.
  function downloadConfirmation() {
    if (typeof window !== 'undefined') window.print()
  }

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-12">
      <div className="space-y-4 text-center print-hidden">
        <span className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-brand text-white shadow-glow">
          <CheckCircle2 className="h-10 w-10" aria-hidden />
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          {t('confirmation.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('confirmation.message')}</p>
        {booking.reference ? (
          <p className="text-muted-foreground">
            {t('confirmation.reference')}:{' '}
            <span className="font-semibold text-foreground">{booking.reference}</span>
          </p>
        ) : null}
      </div>

      {/* Key booking details summary (trip name + dates). */}
      <Card variant="elevated">
        <CardContent className="space-y-1 p-4">
          <p className="font-display font-semibold text-foreground">{booking.name}</p>
          <p className="text-sm text-muted-foreground">{dateRange}</p>
        </CardContent>
      </Card>

      {receipt ? <PaymentReceipt receipt={receipt} /> : null}

      {/* Guide contact info for guide bookings (Requirement 38.9 / 24.5). */}
      {booking.type === 'guide' ? <GuideContactCard bookingId={booking.id} /> : null}

      {/* Next steps & preparation instructions (Requirement 39.9). */}
      <NextSteps type={booking.type} />

      {/* Contact & support info, change/cancellation instructions (Requirement 39.7). */}
      <SupportInfo />

      {/* Confirmation actions (Requirement 39.4 download, 39.8 calendar, share). */}
      <div className="flex flex-col gap-2 print-hidden">
        <Button asChild variant="gradient">
          <Link href={`/bookings/${bookingId}`}>{t('confirmation.viewBooking')}</Link>
        </Button>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <AddToCalendarButton bookingId={booking.id} reference={booking.reference} />
          <Button type="button" variant="outline" onClick={downloadConfirmation}>
            <Download className="mr-1 h-4 w-4" aria-hidden />
            {t('confirmation.downloadConfirmation')}
          </Button>
          <ShareButton title={booking.name} label={t('confirmation.share')} entity="booking" />
        </div>
        {/* Offline QR for sharing the booking (Requirement 33.9). Encodes the
            confirmation URL when available, else the booking reference. */}
        <BookingQrCode
          value={
            typeof window !== 'undefined' ? window.location.href : (booking.reference ?? booking.id)
          }
          caption={booking.reference ?? undefined}
        />
        <Button asChild variant="outline">
          <Link href="/">{t('confirmation.bookAnother')}</Link>
        </Button>
      </div>
    </div>
  )
}

export function ConfirmationView({ bookingId }: { bookingId: string }) {
  return (
    <BookingShell>
      <Inner bookingId={bookingId} />
    </BookingShell>
  )
}
