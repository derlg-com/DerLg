'use client'

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Button } from '@/components/ui'

/**
 * Stripe.js is loaded ONCE, at module scope, not per render.
 *
 * `loadStripe` injects the Stripe script and caches a singleton; calling it on
 * every render re-downloads Stripe.js. It runs only when a publishable key is
 * present so the component can degrade to an "unavailable" state instead of
 * booting Stripe with `undefined`.
 *
 * `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is the PUBLISHABLE (`pk_`) key and is meant
 * to live in the browser bundle — unlike the secret key, which never leaves the
 * backend.
 */
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise: Promise<Stripe | null> | null = publishableKey
  ? loadStripe(publishableKey)
  : null

/**
 * Collects card details and confirms a Stripe PaymentIntent in the browser.
 *
 * Confirmation happens client-side, but marking the booking PAID does not: see
 * the note in the submit handler. The parent's status poll is what observes the
 * webhook-driven result.
 */
export function StripeCardForm({ clientSecret }: { clientSecret: string | undefined }) {
  const t = useTranslations('checkout')

  // No publishable key configured, or no client secret to confirm against: say so
  // plainly instead of mounting an <Elements> that could never resolve.
  if (!stripePromise || !clientSecret) {
    return (
      <div
        className="rounded-[var(--radius-md)] bg-[var(--tone-warning-bg)] px-3 py-2 text-sm text-[var(--tone-warning-text)]"
        role="alert"
      >
        {t('card.unavailable')}
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CardFields />
    </Elements>
  )
}

function CardFields() {
  const t = useTranslations('checkout')
  const stripe = useStripe()
  const elements = useElements()

  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    // Stripe.js not ready yet. The button stays busy until it is, so this only
    // guards against a stray submit rather than an expected path.
    if (!stripe || !elements) return

    setSubmitting(true)
    setError(null)

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // A 3DS challenge leaves the page and returns here; a card that needs no
        // challenge never redirects, because of `redirect: 'if_required'`.
        return_url: window.location.href,
      },
      // Settle in place when possible so the common no-3DS card stays on the page.
      redirect: 'if_required',
    })

    if (result.error) {
      // Stripe's card and validation messages are written for end users, so they
      // are surfaced verbatim rather than replaced with a generic string.
      setError(result.error.message ?? t('errors.startFailed'))
      setSubmitting(false)
      return
    }

    /*
     * CRITICAL: the browser must NOT be trusted to mark the booking paid. Even
     * though confirmPayment resolved without an error, we do NOT call any
     * "confirm" endpoint here. The booking becomes paid only when Stripe's
     * webhook reaches the backend; the parent's status poll observes that
     * webhook-driven result. So we simply keep the control busy and wait.
     */
    setSubmitted(true)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <PaymentElement />

      {error ? (
        <p
          className="rounded-[var(--radius-md)] bg-[var(--tone-danger-bg)] px-3 py-2 text-sm text-[var(--tone-danger-text)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {submitted ? (
        <p className="text-sm text-[var(--text-secondary)]" role="status" aria-live="polite">
          {t('card.processing')}
        </p>
      ) : null}

      {/* Busy until Stripe.js is ready, while confirming, and after a successful
          submit — the parent swaps in the confirmation once the webhook lands. */}
      <Button type="submit" loading={submitting || submitted || !stripe}>
        {t('card.pay')}
      </Button>
    </form>
  )
}
