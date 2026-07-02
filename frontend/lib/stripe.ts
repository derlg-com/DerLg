import { loadStripe, type Stripe } from '@stripe/stripe-js'

/**
 * Stripe.js loader (Requirement 6.2 — display Stripe card payment form using
 * Stripe Elements).
 *
 * The publishable key is browser-safe by design and MUST come from the
 * `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` environment variable — never hardcoded.
 * Stripe.js is loaded exactly once (module-level singleton) and shared across
 * every Elements provider, so card fields are not re-initialised per render.
 *
 * When no key is configured (dev/CI), {@link getStripe} resolves to `null` and
 * {@link isStripeConfigured} returns `false`, so callers can render a graceful
 * "not configured" state instead of crashing.
 */
export const STRIPE_PUBLISHABLE_KEY: string = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''

/** True when a publishable key is configured and Stripe can be initialised. */
export function isStripeConfigured(): boolean {
  return STRIPE_PUBLISHABLE_KEY.length > 0
}

let stripePromise: Promise<Stripe | null> | null = null

/**
 * Return the shared Stripe.js instance, loading it once on first call.
 *
 * Resolves to `null` when no publishable key is configured, allowing dev/CI to
 * run without crashing and callers to render a graceful fallback.
 */
export function getStripe(): Promise<Stripe | null> {
  if (!isStripeConfigured()) {
    return Promise.resolve(null)
  }
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY)
  }
  return stripePromise
}

/**
 * Reset the cached Stripe.js promise. Test-only seam so suites can assert the
 * singleton behaviour without leaking state between cases.
 *
 * @internal
 */
export function __resetStripeForTests(): void {
  stripePromise = null
}
