'use client'

import { useState } from 'react'
import Image from 'next/image'
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { StripeCardElementChangeEvent } from '@stripe/stripe-js'
import { StripeProvider } from './StripeProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { isStripeConfigured } from '@/lib/stripe'
import { isDemoClientSecret, type PaymentMethod, type QrPayment } from '@/lib/payments'

type T = (key: string, vars?: Record<string, string | number>) => string

/**
 * Outcome of a card confirmation attempt, reported up to the parent
 * {@link CheckoutView} so it can navigate to confirmation or surface an error.
 */
export interface CardPayResult {
  status: 'succeeded' | 'failed'
  paymentIntentId?: string
  error?: string
}

/**
 * Stripe Elements card sub-form (Requirements 6.2, 6.4, 6.7). The card element
 * instance is only readable inside the Stripe `<Elements>` context, so the
 * `confirmCardPayment` call lives here rather than in the parent. It:
 * - reads the {@link CardElement} via `useElements`,
 * - confirms the PaymentIntent with `stripe.confirmCardPayment` (3D Secure is
 *   handled automatically by Stripe — it surfaces the challenge and resumes),
 * - reports the outcome up via {@link onResult}.
 *
 * When the provider is in demo mode (sentinel `clientSecret`), it skips Stripe
 * and lets the parent complete the demo charge so dev/CI works without Stripe.
 */
function StripeCardSubForm({
  clientSecret,
  onResult,
  onDemoPay,
  processing,
  t,
}: {
  clientSecret: string | null
  onResult: (r: CardPayResult) => void
  onDemoPay: () => void
  processing: boolean
  t: T
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [complete, setComplete] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  function handleChange(e: StripeCardElementChangeEvent) {
    setComplete(e.complete)
    setCardError(e.error?.message ?? null)
  }

  async function handlePay() {
    setCardError(null)

    // Demo mode (mock provider): no real Stripe intent — delegate to the parent
    // so the booking is confirmed server-side and the loop still completes.
    if (isDemoClientSecret(clientSecret)) {
      onDemoPay()
      return
    }

    if (!stripe || !elements) {
      onResult({ status: 'failed', error: t('failed') })
      return
    }
    if (!clientSecret) {
      onResult({ status: 'failed', error: t('failed') })
      return
    }
    const card = elements.getElement(CardElement)
    if (!card) {
      onResult({ status: 'failed', error: t('failed') })
      return
    }

    setConfirming(true)
    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      })
      if (error) {
        // Card declined, 3DS failed/abandoned, or validation error.
        setCardError(error.message ?? t('failed'))
        onResult({ status: 'failed', error: error.message ?? t('failed') })
        return
      }
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        onResult({ status: 'succeeded', paymentIntentId: paymentIntent.id })
        return
      }
      // Any other terminal status is treated as a failure the user can retry.
      onResult({ status: 'failed', error: t('failed') })
    } finally {
      setConfirming(false)
    }
  }

  const busy = processing || confirming

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="card-element">{t('card.details')}</Label>
        <div id="card-element" className="rounded-md border border-input bg-background px-3 py-3">
          <CardElement
            options={{ style: { base: { fontSize: '16px' } } }}
            onChange={handleChange}
          />
        </div>
        {cardError ? (
          <p role="alert" className="text-sm text-destructive">
            {cardError}
          </p>
        ) : null}
      </div>
      <Button
        onClick={handlePay}
        disabled={busy || !complete}
        variant="gradient"
        className="w-full"
      >
        {busy ? <Spinner size="sm" className="text-primary-foreground" /> : t('card.pay')}
      </Button>
    </div>
  )
}

/**
 * Demo card sub-form used when Stripe is not configured (dev/CI/demo mode).
 * Keeps the booking → checkout → confirmation loop demoable end-to-end against
 * the mock payment provider without requiring Stripe credentials.
 */
function DemoCardSubForm({
  onPay,
  processing,
  t,
}: {
  onPay: () => void
  processing: boolean
  t: T
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t('card.demoFallback')}</p>
      <div className="space-y-1.5">
        <Label htmlFor="cardNumber">{t('card.number')}</Label>
        <Input
          id="cardNumber"
          inputMode="numeric"
          placeholder="4242 4242 4242 4242"
          autoComplete="cc-number"
        />
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

/**
 * Card payment form. Prefers Stripe Elements (Requirements 6.2, 6.4, 6.7) when a
 * publishable key is configured, falling back to the demo form so unconfigured
 * environments stay functional. The Stripe fallback also routes through the
 * demo form rather than dead-ending the user.
 */
function CardForm({
  clientSecret,
  onResult,
  onDemoPay,
  processing,
  t,
}: {
  clientSecret: string | null
  onResult: (r: CardPayResult) => void
  onDemoPay: () => void
  processing: boolean
  t: T
}) {
  if (!isStripeConfigured()) {
    return <DemoCardSubForm onPay={onDemoPay} processing={processing} t={t} />
  }
  return (
    <StripeProvider fallback={<DemoCardSubForm onPay={onDemoPay} processing={processing} t={t} />}>
      <StripeCardSubForm
        clientSecret={clientSecret}
        onResult={onResult}
        onDemoPay={onDemoPay}
        processing={processing}
        t={t}
      />
    </StripeProvider>
  )
}

/**
 * QR payment sub-form (Requirements 6.3, 6.8 — display a QR code image and
 * real-time status). The parent {@link CheckoutView} polls payment status and
 * navigates on success; the manual "I've paid" button triggers an immediate
 * status check for users whose bank app does not push instantly.
 */
function QrForm({
  qr,
  onCheck,
  processing,
  t,
}: {
  qr: QrPayment | null
  onCheck: () => void
  processing: boolean
  t: T
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
      {processing ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size="sm" />
          {t('qr.waiting')}
        </p>
      ) : null}
      <Button onClick={onCheck} disabled={processing} variant="gradient" className="w-full">
        {processing ? <Spinner size="sm" className="text-primary-foreground" /> : t('qr.paid')}
      </Button>
    </div>
  )
}

export interface PaymentFormProps {
  method: PaymentMethod
  qr: QrPayment | null
  /** Stripe PaymentIntent client secret for card payments (null while loading). */
  clientSecret: string | null
  /** Card confirmation result reported up from the Stripe sub-form. */
  onCardResult: (r: CardPayResult) => void
  /** Demo charge path (mock provider / Stripe-not-configured). */
  onDemoPay: () => void
  /** Manual QR status check trigger ("I've paid"). */
  onQrCheck: () => void
  processing: boolean
  t: T
}

/**
 * Method-aware payment form. Renders the Stripe card sub-form for `card` and
 * the QR sub-form for `bakong_qr` / `aba_qr` (Requirements 6.2–6.4, 6.7, 6.8).
 * The amount due, hold countdown, PaymentIntent creation, QR polling, and
 * success/failure navigation are owned by the parent {@link CheckoutView}; this
 * component renders the per-method input UI and surfaces intent/results up.
 */
export function PaymentForm({
  method,
  qr,
  clientSecret,
  onCardResult,
  onDemoPay,
  onQrCheck,
  processing,
  t,
}: PaymentFormProps) {
  if (method === 'card') {
    return (
      <CardForm
        clientSecret={clientSecret}
        onResult={onCardResult}
        onDemoPay={onDemoPay}
        processing={processing}
        t={t}
      />
    )
  }
  return <QrForm qr={qr} onCheck={onQrCheck} processing={processing} t={t} />
}
