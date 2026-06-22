'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { BookingShell } from '@/components/booking/BookingShell'
import { useApiQuery } from '@/lib/use-api-query'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/lib/i18n'
import type { BookingDetail } from '@/types/api'

function Inner({ bookingId }: { bookingId: string }) {
  const t = useTranslations('checkout')
  const { data: booking } = useApiQuery<BookingDetail>(`/v1/bookings/${bookingId}`)

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-12 text-center">
      <span className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-brand text-white shadow-glow">
        <CheckCircle2 className="h-10 w-10" aria-hidden />
      </span>
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{t('confirmation.title')}</h1>
      {booking?.reference ? (
        <p className="text-muted-foreground">
          {t('confirmation.reference')}:{' '}
          <span className="font-semibold text-foreground">{booking.reference}</span>
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button asChild variant="gradient">
          <Link href={`/bookings/${bookingId}`}>{t('confirmation.viewBooking')}</Link>
        </Button>
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
