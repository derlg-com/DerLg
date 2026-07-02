'use client'

import { useState } from 'react'
import { MapPin, Ticket } from 'lucide-react'
import { BookingShell } from '@/components/booking/BookingShell'
import { SupportInfo } from '@/components/checkout/SupportInfo'
import { GuideContactCard } from '@/components/checkout/GuideContactCard'
import { CancelBookingModal } from './CancelBookingModal'
import { AddToCalendarButton } from './AddToCalendarButton'
import { WriteReviewButton } from '@/components/reviews/WriteReviewButton'
import { EmergencyAlertButton } from '@/components/emergency/EmergencyAlertButton'
import { EmergencyAlertModal } from '@/components/emergency/EmergencyAlertModal'
import { useApiQuery } from '@/lib/use-api-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { statusVariant, bookingGroup } from '@/lib/bookings-display'
import { formatCurrency, formatDateShort } from '@/lib/format'
import { useCurrency } from '@/hooks/use-currency'
import { useLanguageStore, useTranslations } from '@/lib/i18n'
import type { BookingDetail } from '@/types/api'

function BookingDetailInner({ id }: { id: string }) {
  const t = useTranslations('bookings')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const {
    data: booking,
    isLoading,
    error,
    refetch,
  } = useApiQuery<BookingDetail>(`/v1/bookings/${id}`)
  const isConfirmed = booking?.status === 'CONFIRMED'
  const { data: qr } = useApiQuery<{ qrCodeUrl: string }>(
    isConfirmed ? `/v1/bookings/${id}/qr` : null,
  )
  const [cancelOpen, setCancelOpen] = useState(false)
  const [emergencyOpen, setEmergencyOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <EmptyState
          icon={Ticket}
          title={error?.status === 404 ? t('detail.notFound') : t('list.errorTitle')}
          description={error?.status === 404 ? undefined : t('list.errorDesc')}
          action={
            error?.status === 404 ? undefined : (
              <Button variant="outline" size="sm" onClick={refetch}>
                {t('list.retry')}
              </Button>
            )
          }
        />
      </div>
    )
  }

  const dateRange =
    booking.endDate && booking.endDate !== booking.startDate
      ? `${formatDateShort(booking.startDate, locale)} – ${formatDateShort(booking.endDate, locale)}`
      : formatDateShort(booking.startDate, locale)
  const canCancel = bookingGroup(booking.status) === 'upcoming' && booking.status === 'CONFIRMED'

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{booking.name}</h1>
          <p className="text-sm text-muted-foreground">{booking.reference}</p>
          <p className="text-sm text-muted-foreground">{dateRange}</p>
        </div>
        <Badge variant={statusVariant(booking.status)}>{t(`status.${booking.status}`)}</Badge>
      </div>

      {booking.location ? (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="text-foreground">{t('detail.location')}</span>: {booking.location}
          </span>
        </div>
      ) : null}

      {isConfirmed && qr?.qrCodeUrl ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-4">
            <p className="text-sm font-medium text-foreground">{t('detail.qrTitle')}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- QR served from variable backend/CDN host */}
            <img src={qr.qrCodeUrl} alt={t('detail.qrTitle')} className="h-44 w-44 rounded-md" />
          </CardContent>
        </Card>
      ) : null}

      {booking.items && booking.items.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">{t('detail.items')}</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {booking.items.map((item, i) => (
              <li key={item.id ?? i} className="flex items-center justify-between p-3 text-sm">
                <span className="text-foreground">
                  {item.name}
                  {item.quantity ? ` × ${item.quantity}` : ''}
                </span>
                {item.totalPriceUsd != null ? (
                  <span className="text-muted-foreground">
                    {formatCurrency(item.totalPriceUsd, locale, currency)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <span className="font-medium text-foreground">{t('detail.total')}</span>
        <span className="text-lg font-semibold text-foreground">
          {formatCurrency(booking.totalPriceUsd, locale, currency)}
        </span>
      </div>

      {booking.specialRequests ? (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">{t('detail.specialRequests')}</h2>
          <p className="text-sm text-muted-foreground">{booking.specialRequests}</p>
        </section>
      ) : null}

      {booking.status === 'CANCELLED' && booking.refundAmountUsd != null ? (
        <div className="rounded-md bg-muted p-3 text-sm">
          {t('detail.refunded')}: {formatCurrency(booking.refundAmountUsd, locale, currency)}
        </div>
      ) : null}

      {/* Guide contact info for confirmed guide bookings (Requirement 38.9 / 24.5). */}
      {booking.type === 'guide' && isConfirmed ? <GuideContactCard bookingId={booking.id} /> : null}

      <SupportInfo />

      <WriteReviewButton
        bookingId={booking.id}
        bookingType={booking.type}
        status={booking.status}
        className="w-full"
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <AddToCalendarButton
          bookingId={booking.id}
          reference={booking.reference}
          className="sm:flex-1"
        />
        {canCancel ? (
          <Button variant="destructive" onClick={() => setCancelOpen(true)} className="sm:flex-1">
            {t('detail.cancel')}
          </Button>
        ) : null}
      </div>

      <EmergencyAlertButton
        bookingId={booking.id}
        startDate={booking.startDate}
        status={booking.status}
        onActivate={() => setEmergencyOpen(true)}
        className="w-full"
      />

      <EmergencyAlertModal
        open={emergencyOpen}
        onOpenChange={setEmergencyOpen}
        bookingId={booking.id}
      />

      <CancelBookingModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        bookingId={booking.id}
        startDate={booking.startDate}
        totalUsd={booking.totalPriceUsd}
        onCancelled={refetch}
      />
    </div>
  )
}

export function BookingDetailView({ id }: { id: string }) {
  return (
    <BookingShell>
      <BookingDetailInner id={id} />
    </BookingShell>
  )
}
