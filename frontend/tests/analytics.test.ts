import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { trackEvent } from '@/lib/analytics'
import { useConsentStore } from '@/stores/consent.store'

interface TestWindow {
  gtag?: (...args: unknown[]) => void
  dataLayer?: unknown[]
}

beforeEach(() => {
  // trackEvent is cookie-consent gated (Requirements 23.7, 50.4, 50.5); grant
  // analytics consent so the provider-forwarding tests exercise the real path.
  useConsentStore.getState().acceptCookies()
})

afterEach(() => {
  const w = window as unknown as TestWindow
  delete w.gtag
  delete w.dataLayer
  useConsentStore.getState().resetConsent()
  vi.restoreAllMocks()
})

describe('trackEvent', () => {
  it('forwards to window.gtag when present', () => {
    const gtag = vi.fn()
    ;(window as unknown as TestWindow).gtag = gtag
    trackEvent('share', { method: 'copy', entity: 'trip' })
    expect(gtag).toHaveBeenCalledWith('event', 'share', { method: 'copy', entity: 'trip' })
  })

  it('pushes to dataLayer when no gtag is present', () => {
    const dataLayer: unknown[] = []
    ;(window as unknown as TestWindow).dataLayer = dataLayer
    trackEvent('share', { method: 'whatsapp' })
    expect(dataLayer).toEqual([{ event: 'share', method: 'whatsapp' }])
  })

  it('is a safe no-op when no provider is present', () => {
    expect(() => trackEvent('share', { method: 'email' })).not.toThrow()
  })

  it('does not track until analytics consent is granted', () => {
    useConsentStore.getState().resetConsent()
    const dataLayer: unknown[] = []
    ;(window as unknown as TestWindow).dataLayer = dataLayer
    trackEvent('share', { method: 'whatsapp' })
    expect(dataLayer).toEqual([])
  })
})
