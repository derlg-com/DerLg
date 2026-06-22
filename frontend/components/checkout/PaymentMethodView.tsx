'use client'

import Link from 'next/link'
import { CreditCard, QrCode } from 'lucide-react'
import { BookingShell, BookingSummary } from '@/components/booking/BookingShell'
import { HoldTimer } from './HoldTimer'
import { useApiQuery } from '@/lib/use-api-query'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/format'
import { useCurrency } from '@/hooks/use-currency'
import { useLanguageStore, useTranslations } from '@/lib/i18n'
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payments'
import type { BookingDetail } from '@/types/api'

const METHOD_ICON: Record<PaymentMethod, typeof CreditCard> = {
  card: CreditCard,
  bakong_qr: QrCode,
  aba_qr: QrCode,
}

function Inner({ bookingId }: { bookingId: string }) {
  const t = useTranslations('checkout')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const { data: booking, isLoading } = useApiQuery<BookingDetail>(`/v1/bookings/${bookingId}`)

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-foreground">{t('method.title')}</h1>
        <HoldTimer holdExpiresAt={booking?.holdExpiresAt} />
      </div>
      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-lg" />
      ) : booking ? (
        <BookingSummary
          name={booking.name}
          imageUrl={booking.coverImageUrl}
          priceLabel={formatCurrency(booking.totalPriceUsd, locale, currency)}
        />
      ) : null}
      <div className="space-y-2">
        {PAYMENT_METHODS.map((m) => {
          const Icon = METHOD_ICON[m]
          return (
            <Link key={m} href={`/checkout/${bookingId}?method=${m}`} className="block focus-visible:outline-none">
              <Card className="flex items-center gap-3 p-4 transition-shadow hover:shadow-md">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
                <span className="font-medium text-foreground">{t(`method.${m}`)}</span>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function PaymentMethodView({ bookingId }: { bookingId: string }) {
  return (
    <BookingShell>
      <Inner bookingId={bookingId} />
    </BookingShell>
  )
}
