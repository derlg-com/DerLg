'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Info } from 'lucide-react'
import { BookingShell } from '@/components/booking/BookingShell'
import { HoldTimer } from './HoldTimer'
import { useApiQuery } from '@/lib/use-api-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrency } from '@/lib/format'
import { useCurrency } from '@/hooks/use-currency'
import { useLanguageStore, useTranslations } from '@/lib/i18n'
import { getPaymentProvider, isMockPayments, type PaymentMethod, type QrPayment } from '@/lib/payments'
import type { BookingDetail } from '@/types/api'

function CardForm({ onPay, processing, t }: { onPay: () => void; processing: boolean; t: (k: string) => string }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="cardNumber">{t('card.number')}</Label>
        <Input id="cardNumber" inputMode="numeric" placeholder="4242 4242 4242 4242" autoComplete="cc-number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cardExpiry">{t('card.expiry')}</Label>
          <Input id="cardExpiry" placeholder="MM/YY" autoComplete="cc-exp" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cardCvc">{t('card.cvc')}</Label>
          <Input id="cardCvc" inputMode="numeric" placeholder="123" autoComplete="cc-csc" />
        </div>
      </div>
      <Button onClick={onPay} disabled={processing} variant="gradient" className="w-full">
        {processing ? <Spinner size="sm" className="text-primary-foreground" /> : t('card.pay')}
      </Button>
    </div>
  )
}

function QrView({
  qr,
  onPaid,
  processing,
  t,
}: {
  qr: QrPayment | null
  onPaid: () => void
  processing: boolean
  t: (k: string) => string
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-muted-foreground">{t('qr.scan')}</p>
      {qr ? (
        <Image
          src={qr.qrImageUrl}
          alt="Payment QR"
          width={240}
          height={240}
          className="rounded-lg border border-border"
          unoptimized
        />
      ) : (
        <Skeleton className="h-60 w-60 rounded-lg" />
      )}
      <Button onClick={onPaid} disabled={processing} variant="gradient" className="w-full">
        {processing ? <Spinner size="sm" className="text-primary-foreground" /> : t('qr.paid')}
      </Button>
    </div>
  )
}

function Inner({ bookingId, method }: { bookingId: string; method: PaymentMethod }) {
  const t = useTranslations('checkout')
  const router = useRouter()
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const { data: booking, isLoading } = useApiQuery<BookingDetail>(`/v1/bookings/${bookingId}`)
  const provider = getPaymentProvider()
  const isQr = method !== 'card'
  const [qr, setQr] = useState<QrPayment | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isQr) return
    provider.getQr({ bookingId, method }).then(setQr).catch(() => setQr(null))
  }, [isQr, bookingId, method, provider])

  function pay() {
    setProcessing(true)
    setError(null)
    provider
      .pay({ bookingId, method })
      .then((r) => {
        if (r.status === 'succeeded') {
          router.push(`/checkout/${bookingId}/confirmation`)
        } else {
          setProcessing(false)
          setError(t('failed'))
        }
      })
      .catch(() => {
        setProcessing(false)
        setError(t('failed'))
      })
  }

  const total = booking?.totalPriceUsd ?? 0

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{t('title')}</h1>
        <HoldTimer holdExpiresAt={booking?.holdExpiresAt} />
      </div>

      {isMockPayments() ? (
        <p className="flex items-start gap-2 rounded-md bg-warning/15 px-3 py-2 text-sm text-warning">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t('mockNotice')}
        </p>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : (
        <Card variant="elevated">
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{t('subtotal')}</span>
              <span>{formatCurrency(total, locale, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground">
              <span>{t('total')}</span>
              <span>{formatCurrency(total, locale, currency)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {error ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {isQr ? (
        <QrView qr={qr} onPaid={pay} processing={processing} t={t} />
      ) : (
        <CardForm onPay={pay} processing={processing} t={t} />
      )}
    </div>
  )
}

export function CheckoutView({ bookingId, method }: { bookingId: string; method: PaymentMethod }) {
  return (
    <BookingShell>
      <Inner bookingId={bookingId} method={method} />
    </BookingShell>
  )
}
