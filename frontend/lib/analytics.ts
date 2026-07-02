'use client'

import { hasAnalyticsConsent } from '@/stores/consent.store'

/**
 * Minimal, no-op-safe analytics wrapper (task 27.3 / Requirement 33.7).
 *
 * This is a thin shim, not a full analytics provider. It lets feature code emit
 * semantic events (e.g. `trackEvent('share', { method: 'whatsapp' })`) today
 * without coupling to a vendor. Behaviour:
 *
 * - Cookie-consent gated (Section 32 / Requirements 23.7, 50.4, 50.5): when the
 *   user has not accepted cookies, `trackEvent` is a hard no-op so no
 *   non-essential analytics fire. Consent is read (non-reactively) from the
 *   {@link import('@/stores/consent.store') consent store} via
 *   {@link hasAnalyticsConsent}; the store defaults to "undecided" → no
 *   tracking until the user explicitly accepts in the cookie banner.
 * - In development it logs the event to the console for visibility (only once
 *   consent is granted).
 * - If a Google Analytics-style `window.gtag` is present (loaded when
 *   `NEXT_PUBLIC_GA_ID` is configured), the event is forwarded to it.
 * - Otherwise, if a `window.dataLayer` (GTM) exists, the event is pushed there.
 * - If neither is present it degrades gracefully to a no-op — nothing throws.
 *
 * A real analytics provider (Sentry breadcrumbs, batching) is wired in Section
 * 38; this wrapper is the stable call-site contract so that later work can swap
 * the implementation without touching every feature.
 */

type GtagFn = (command: 'event', eventName: string, params?: Record<string, unknown>) => void

interface AnalyticsWindow extends Window {
  gtag?: GtagFn
  dataLayer?: unknown[]
}

/** Properties attached to an analytics event. Values must be serialisable. */
export type EventProps = Record<string, string | number | boolean | null | undefined>

/**
 * Emit an analytics event. Safe to call from any client component; never throws
 * and is a no-op on the server or when no provider is present.
 *
 * @param name   Event name, e.g. `'share'`.
 * @param props  Optional event properties, e.g. `{ method: 'copy', entity: 'trip' }`.
 */
export function trackEvent(name: string, props?: EventProps): void {
  if (typeof window === 'undefined') return

  // Cookie-consent gate: do nothing until the user accepts non-essential
  // cookies (Requirements 23.7, 50.4, 50.5). When rejected/undecided this is a
  // hard no-op so no analytics provider is ever invoked.
  if (!hasAnalyticsConsent()) return

  const w = window as AnalyticsWindow

  // Dev visibility — helps confirm events fire before a provider is wired up.
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[analytics]', name, props ?? {})
  }

  try {
    if (typeof w.gtag === 'function') {
      w.gtag('event', name, props)
      return
    }
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event: name, ...props })
      return
    }
    // No provider present: degrade gracefully (no-op).
  } catch {
    // Never let analytics break a user action.
  }
}
