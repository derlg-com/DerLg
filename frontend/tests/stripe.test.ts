import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Stripe.js so tests never hit the network. Each call returns a distinct
// sentinel so we can assert the loader is invoked exactly once.
const loadStripeMock = vi.fn()
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: (...args: unknown[]) => loadStripeMock(...args),
}))

const KEY_ENV = 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'

/** Load a fresh copy of lib/stripe with the env configured as given. */
async function freshStripeModule(key: string | undefined) {
  vi.resetModules()
  if (key === undefined) {
    delete process.env[KEY_ENV]
  } else {
    process.env[KEY_ENV] = key
  }
  return import('@/lib/stripe')
}

describe('lib/stripe', () => {
  const originalKey = process.env[KEY_ENV]

  beforeEach(() => {
    loadStripeMock.mockReset()
  })

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env[KEY_ENV]
    } else {
      process.env[KEY_ENV] = originalKey
    }
  })

  describe('when no publishable key is configured', () => {
    it('reports not configured and never loads Stripe.js', async () => {
      const stripe = await freshStripeModule('')

      expect(stripe.isStripeConfigured()).toBe(false)
      await expect(stripe.getStripe()).resolves.toBeNull()
      expect(loadStripeMock).not.toHaveBeenCalled()
    })

    it('treats a missing env var the same as an empty key', async () => {
      const stripe = await freshStripeModule(undefined)

      expect(stripe.isStripeConfigured()).toBe(false)
      await expect(stripe.getStripe()).resolves.toBeNull()
      expect(loadStripeMock).not.toHaveBeenCalled()
    })
  })

  describe('when a publishable key is configured', () => {
    it('reports configured and loads Stripe.js with the env key', async () => {
      const fakeStripe = { id: 'stripe-instance' }
      loadStripeMock.mockResolvedValue(fakeStripe)

      const stripe = await freshStripeModule('pk_test_abc123')

      expect(stripe.isStripeConfigured()).toBe(true)
      await expect(stripe.getStripe()).resolves.toBe(fakeStripe)
      expect(loadStripeMock).toHaveBeenCalledWith('pk_test_abc123')
    })

    it('loads Stripe.js only once across many getStripe() calls (singleton)', async () => {
      loadStripeMock.mockResolvedValue({ id: 'stripe-instance' })

      const stripe = await freshStripeModule('pk_test_singleton')

      const a = stripe.getStripe()
      const b = stripe.getStripe()
      const c = stripe.getStripe()

      // Same promise reference is reused for every call.
      expect(a).toBe(b)
      expect(b).toBe(c)
      await Promise.all([a, b, c])
      expect(loadStripeMock).toHaveBeenCalledTimes(1)
    })

    it('reloads after the test reset seam clears the cached promise', async () => {
      loadStripeMock.mockResolvedValue({ id: 'stripe-instance' })

      const stripe = await freshStripeModule('pk_test_reset')

      await stripe.getStripe()
      stripe.__resetStripeForTests()
      await stripe.getStripe()

      expect(loadStripeMock).toHaveBeenCalledTimes(2)
    })
  })
})
