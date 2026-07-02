'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Info } from 'lucide-react'
import { BookingShell } from '@/components/booking/BookingShell'
import { HoldTimer } from './HoldTimer'
import { PaymentForm, type CardPayResult } from './PaymentForm'
import { useApiQuery } from '@/lib/use-api-query'
import { useBookingHold } from '@/hooks/use-booking-hold'
import { usePaymentStatus } from '@/hooks/use-payment-status'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/format'
import { useCurrency } from '@/hooks/use-currency'
import { useLanguageStore, useTranslations } from '@/lib/i18n'
import {
  getPaymentProvider,
  isMockPayments,
  type PaymentMethod,
  type QrPayment,
} from '@/lib/payments'
import type { BookingDetail } from '@/types/api'

function Inner({ bookingId, method }: { bookingId: string; method: PaymentMethod }) {
  const t = useTranslations('checkout')
  const router = useRouter()
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const { data: booking, isLoading } = useApiQuery<BookingDetail>(`/v1/bookings/${bookingId}`)
  const provider = getPaymentProvider()
  const isQr = method !== 'card'

  const [qr, setQr] = useState<QrPayment | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hold expiry (Requirement tied to the 15-min hold): once the hold lapses the
  // booking can no longer be paid, so we block payment and tell the user.
  const { expired } = useBookingHold(booking?.holdExpiresAt)

  const goToConfirmation = useCallback(() => {
    router.push(`/checkout/${bookingId}/confirmation`)
  }, [router, bookingId])

  // Card path: create (or fetch) the Stripe PaymentIntent so the card sub-form
  // can confirm it. Demo mode hands back a sentinel client secret.
  useEffect(() => {
    if (isQr || expired) return
    let active = true
    provider
      .createPaymentIntent({ bookingId, method })
      .then((pi) => {
        if (active) setClientSecret(pi.clientSecret)
      })
      .catch(() => {
        if (active) setError(t('failed'))
      })
    return () => {
      active = false
    }
  }, [isQr, expired, bookingId, method, provider, t])

  // QR path: fetch the QR image to display.
  useEffect(() => {
    if (!isQr || expired) return
    let active = true
    provider
      .getQr({ bookingId, method })
      .then((q) => {
        if (active) setQr(q)
      })
      .catch(() => {
        if (active) setQr(null)
      })
    return () => {
      active = false
    }
  }, [isQr, expired, bookingId, method, provider])

  // QR path: poll payment status until paid/failed/expired (Requirement 6.8).
  // Stop polling once the hold expires — the booking is no longer payable.
  const qrStatus = usePaymentStatus({
    enabled: isQr && !expired,
    bookingId,
    method,
    onPaid: goToConfirmation,
  })

  // Card success → confirm server-side then navigate (Requirements 6.4, 6.5).
  const handleCardResult = useCallback(
    (r: CardPayResult) => {
      if (r.status !== 'succeeded') {
        setProcessing(false)
        setError(r.error ?? t('failed'))
        return
      }
      provider
        .confirmCardSuccess({ bookingId, paymentIntentId: r.paymentIntentId ?? '' })
        .then(goToConfirmation)
        .catch(() => {
          setProcessing(false)
          setError(t('failed'))
        })
    },
    [provider, bookingId, goToConfirmation, t],
  )

  // Demo charge path (mock provider / Stripe not configured): confirm via the
  // provider's pay() so the loop completes without real Stripe (Requirement 6.5).
  const handleDemoPay = useCallback(() => {
    setProcessing(true)
    setError(null)
    provider
      .pay({ bookingId, method })
      .then((res) => {
        if (res.status === 'succeeded') {
          goToConfirmation()
        } else {
          setProcessing(false)
          setError(t('failed'))
        }
      })
      .catch(() => {
        setProcessing(false)
        setError(t('failed'))
      })
  }, [provider, bookingId, method, goToConfirmation, t])

  // Manual "I've paid" for QR: trigger an immediate status check (Requirement 6.8).
  const handleQrCheck = useCallback(() => {
    setProcessing(true)
    setError(null)
    provider
      .getStatus({ bookingId, method })
      .then((res) => {
        if (res.status === 'paid') {
          goToConfirmation()
        } else {
          setProcessing(false)
          if (res.status === 'expired') setError(t('expired'))
          else if (res.status === 'failed') setError(t('failed'))
          else setError(t('qr.notYetPaid'))
        }
      })
      .catch(() => {
        setProcessing(false)
        setError(t('failed'))
      })
  }, [provider, bookingId, method, goToConfirmation, t])

  const total = booking?.totalPriceUsd ?? 0

  // Terminal QR poll states are surfaced as a (non-stateful) banner so we avoid
  // setState-in-effect; manual errors still take precedence when present.
  const qrPollError =
    isQr && qrStatus.status === 'failed'
      ? t('failed')
      : isQr && qrStatus.status === 'expired'
        ? t('expired')
        : null
  const displayError = error ?? qrPollError
  // Stop showing the spinner once polling reaches a terminal state.
  const qrPolling =
    isQr &&
    (qrStatus.status === 'pending' ||
      qrStatus.status === 'processing' ||
      qrStatus.status === 'idle')
  const showProcessing = processing && (!isQr || qrPolling)

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {t('title')}
        </h1>
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

      {displayError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {displayError}
        </p>
      ) : null}

      {expired ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('holdExpiredNotice')}
        </p>
      ) : (
        <PaymentForm
          method={method}
          qr={qr}
          clientSecret={clientSecret}
          onCardResult={handleCardResult}
          onDemoPay={handleDemoPay}
          onQrCheck={handleQrCheck}
          processing={showProcessing}
          t={t}
        />
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
