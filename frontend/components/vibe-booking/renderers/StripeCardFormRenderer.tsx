'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import type { ContentItem } from '@/stores/vibe-booking.store'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { formatCurrency } from '@/lib/format'

interface Props {
  item: ContentItem
  onAction: (type: string, itemId?: string, payload?: Record<string, unknown>) => void
}

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''

let stripePromise: Promise<Stripe | null> | null = null
function getStripe(): Promise<Stripe | null> {
  if (!stripePromise && STRIPE_PUBLISHABLE_KEY) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY)
  }
  return stripePromise ?? Promise.resolve(null)
}

interface StripeFormPayload {
  bookingId: string
  paymentIntentId?: string
  clientSecret?: string
  amount: { usd: number; khr?: number }
  expiry?: string
}

function StripePaymentForm({
  payload,
  onAction,
  itemId,
}: {
  payload: StripeFormPayload
  itemId?: string
  onAction: Props['onAction']
}) {
  const stripe = useStripe()
  const elements = useElements()
  const t = useTranslations()
  const locale = useLanguageStore((s) => s.locale)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [stage, setStage] = useState<'form' | 'processing' | 'success' | 'failed'>('form')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setErrorMessage(null)
    setStage('processing')

    const cardEl = elements.getElement(CardNumberElement)
    if (!cardEl) {
      setStage('failed')
      setSubmitting(false)
      return
    }

    if (!payload.clientSecret) {
      setErrorMessage('Missing payment intent — please retry from chat.')
      setStage('failed')
      setSubmitting(false)
      return
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(payload.clientSecret, {
      payment_method: { card: cardEl },
    })

    if (error) {
      setErrorMessage(error.message ?? 'Payment failed.')
      setStage('failed')
      setSubmitting(false)
      return
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      setStage('success')
      onAction('payment_completed', itemId, {
        booking_id: payload.bookingId,
        payment_intent_id: paymentIntent.id,
      })
    } else if (paymentIntent && paymentIntent.status === 'requires_action') {
      // 3DS redirect handled automatically by confirmCardPayment
      setStage('processing')
    } else {
      setStage('failed')
      setErrorMessage('Payment did not succeed.')
    }
    setSubmitting(false)
  }

  if (stage === 'success') {
    return (
      <div className="p-6 text-center space-y-2">
        <div className="text-4xl">✅</div>
        <p className="font-bold text-lg">{t('booking.paymentSuccess')}</p>
        <p className="text-sm text-muted-foreground">{formatCurrency(payload.amount.usd, locale)}</p>
      </div>
    )
  }

  if (stage === 'processing') {
    return (
      <div className="p-6 text-center space-y-3">
        <div className="animate-spin h-10 w-10 mx-auto border-2 border-primary border-t-transparent rounded-full" />
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-3">
      <p className="font-semibold">{t('booking.paymentMethod')}</p>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">{t('booking.cardNumber')}</label>
        <div className="border border-input rounded-md px-3 py-2 bg-background">
          <CardNumberElement options={{ style: { base: { fontSize: '14px' } } }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">{t('booking.expiry')}</label>
            <div className="border border-input rounded-md px-3 py-2 bg-background">
              <CardExpiryElement options={{ style: { base: { fontSize: '14px' } } }} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t('booking.cvc')}</label>
            <div className="border border-input rounded-md px-3 py-2 bg-background">
              <CardCvcElement options={{ style: { base: { fontSize: '14px' } } }} />
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium disabled:opacity-50"
      >
        {submitting
          ? t('common.loading')
          : `${t('booking.confirmBooking')} • ${formatCurrency(payload.amount.usd, locale)}`}
      </button>
    </form>
  )
}

export default function StripeCardFormRenderer({ item, onAction }: Props) {
  const data = item.data as StripeFormPayload
  const stripeInstance = useMemo(() => getStripe(), [])
  const [stripeReady, setStripeReady] = useState(false)
  const t = useTranslations()

  useEffect(() => {
    stripeInstance.then((s) => setStripeReady(!!s))
  }, [stripeInstance])

  if (!STRIPE_PUBLISHABLE_KEY) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable card payments.
      </div>
    )
  }

  if (!stripeReady) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
    )
  }

  return (
    <Elements stripe={stripeInstance}>
      <StripePaymentForm payload={data} itemId={item.id} onAction={onAction} />
    </Elements>
  )
}
