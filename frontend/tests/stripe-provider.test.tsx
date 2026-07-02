import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Control configuration/loading via the shared stripe module rather than env.
const isStripeConfigured = vi.fn()
const getStripe = vi.fn()
vi.mock('@/lib/stripe', () => ({
  isStripeConfigured: () => isStripeConfigured(),
  getStripe: () => getStripe(),
}))

// Avoid mounting the real Stripe.js <Elements> internals in jsdom.
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stripe-elements">{children}</div>
  ),
}))

import { StripeProvider } from '@/components/checkout/StripeProvider'
import { useLanguageStore } from '@/lib/i18n'

describe('StripeProvider', () => {
  beforeEach(() => {
    isStripeConfigured.mockReset()
    getStripe.mockReset()
    useLanguageStore.setState({ locale: 'en' })
  })

  it('renders a graceful fallback (no Elements) when Stripe is not configured', () => {
    isStripeConfigured.mockReturnValue(false)
    getStripe.mockResolvedValue(null)

    render(
      <StripeProvider>
        <div>card form</div>
      </StripeProvider>,
    )

    expect(screen.queryByTestId('stripe-elements')).not.toBeInTheDocument()
    expect(screen.queryByText('card form')).not.toBeInTheDocument()
    // Default fallback uses the translated booking.stripeNotConfigured key.
    expect(screen.getByText(/Card payments are unavailable/i)).toBeInTheDocument()
  })

  it('renders a custom fallback when provided and unconfigured', () => {
    isStripeConfigured.mockReturnValue(false)
    getStripe.mockResolvedValue(null)

    render(
      <StripeProvider fallback={<div>use QR instead</div>}>
        <div>card form</div>
      </StripeProvider>,
    )

    expect(screen.getByText('use QR instead')).toBeInTheDocument()
    expect(screen.queryByTestId('stripe-elements')).not.toBeInTheDocument()
  })

  it('mounts Elements with the loaded Stripe instance once configured and ready', async () => {
    isStripeConfigured.mockReturnValue(true)
    getStripe.mockResolvedValue({ id: 'stripe-instance' })

    render(
      <StripeProvider>
        <div>card form</div>
      </StripeProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('stripe-elements')).toBeInTheDocument())
    expect(screen.getByText('card form')).toBeInTheDocument()
  })
})
