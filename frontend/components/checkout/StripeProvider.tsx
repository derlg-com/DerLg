'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import type { StripeElementsOptions } from '@stripe/stripe-js'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { useTranslations } from '@/lib/i18n'

interface StripeProviderProps {
  children: ReactNode
  /**
   * Options forwarded to Stripe Elements (e.g. `clientSecret`, `appearance`).
   * Optional — Elements can be created without a client secret and given one
   * later via the individual element APIs.
   */
  options?: StripeElementsOptions
  /**
   * Rendered when no publishable key is configured. Defaults to a translated
   * "Stripe not configured" notice so dev/CI never crash on a missing key.
   */
  fallback?: ReactNode
  /** Rendered while Stripe.js is loading. Defaults to a translated loading notice. */
  loading?: ReactNode
}

/**
 * Reusable Stripe Elements provider for the checkout flow (Requirement 6.2).
 *
 * Wraps children in `<Elements>` backed by the shared, lazily-loaded Stripe.js
 * singleton from `@/lib/stripe`. When no publishable key is configured the
 * provider renders {@link StripeProviderProps.fallback} instead of mounting
 * Elements, so development and CI environments without Stripe credentials do
 * not crash.
 */
export function StripeProvider({ children, options, fallback, loading }: StripeProviderProps) {
  const t = useTranslations()
  const stripePromise = useMemo(() => getStripe(), [])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    stripePromise.then((stripe) => {
      if (active) setReady(!!stripe)
    })
    return () => {
      active = false
    }
  }, [stripePromise])

  if (!isStripeConfigured()) {
    return (
      <>
        {fallback ?? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {t('booking.stripeNotConfigured')}
          </div>
        )}
      </>
    )
  }

  if (!ready) {
    return (
      <>
        {loading ?? (
          <div className="p-6 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
        )}
      </>
    )
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  )
}
