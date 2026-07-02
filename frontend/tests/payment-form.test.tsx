import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Control Stripe configuration so we can exercise both the Stripe Elements
// path and the demo fallback without real credentials.
const isStripeConfigured = vi.fn()
const getStripe = vi.fn()
vi.mock('@/lib/stripe', () => ({
  isStripeConfigured: () => isStripeConfigured(),
  getStripe: () => getStripe(),
}))

// Stripe.js confirmation + element access stubs. confirmCardPayment is
// configurable per-test so we can assert success / decline / 3DS handling.
const confirmCardPayment = vi.fn()
const getElement = vi.fn(() => ({ id: 'card' }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stripe-elements">{children}</div>
  ),
  CardElement: (props: { onChange?: (e: unknown) => void }) => (
    <button
      type="button"
      data-testid="card-element"
      onClick={() => props.onChange?.({ complete: true, error: undefined })}
    >
      card-element
    </button>
  ),
  useStripe: () => ({ confirmCardPayment }),
  useElements: () => ({ getElement }),
}))

import { PaymentForm } from '@/components/checkout/PaymentForm'
import { useLanguageStore } from '@/lib/i18n'
import type { QrPayment } from '@/lib/payments'

const t = (key: string) => key

const qr: QrPayment = { qrImageUrl: 'https://example.test/qr.png', reference: 'ref-1' }

function renderForm(overrides: Partial<React.ComponentProps<typeof PaymentForm>> = {}) {
  const props: React.ComponentProps<typeof PaymentForm> = {
    method: 'card',
    qr: null,
    clientSecret: 'pi_secret_123',
    onCardResult: vi.fn(),
    onDemoPay: vi.fn(),
    onQrCheck: vi.fn(),
    processing: false,
    t,
    ...overrides,
  }
  return { props, ...render(<PaymentForm {...props} />) }
}

describe('PaymentForm', () => {
  beforeEach(() => {
    isStripeConfigured.mockReset()
    getStripe.mockReset()
    confirmCardPayment.mockReset()
    getElement.mockReset().mockReturnValue({ id: 'card' })
    useLanguageStore.setState({ locale: 'en' })
  })

  it('renders the demo card sub-form when Stripe is not configured (mock/demo mode)', () => {
    isStripeConfigured.mockReturnValue(false)

    renderForm({ clientSecret: 'demo_secret_b1' })

    expect(screen.queryByTestId('stripe-elements')).not.toBeInTheDocument()
    expect(screen.getByLabelText('card.number')).toBeInTheDocument()
    expect(screen.getByLabelText('card.expiry')).toBeInTheDocument()
    expect(screen.getByLabelText('card.cvc')).toBeInTheDocument()
  })

  it('demo card pay button triggers onDemoPay (mock provider loop)', () => {
    isStripeConfigured.mockReturnValue(false)
    const onDemoPay = vi.fn()

    renderForm({ clientSecret: 'demo_secret_b1', onDemoPay })

    fireEvent.click(screen.getByRole('button', { name: 'card.pay' }))
    expect(onDemoPay).toHaveBeenCalledTimes(1)
  })

  it('renders Stripe Elements CardElement when Stripe is configured', async () => {
    isStripeConfigured.mockReturnValue(true)
    getStripe.mockResolvedValue({ id: 'stripe-instance' })

    renderForm()

    await screen.findByTestId('stripe-elements')
    expect(screen.getByTestId('card-element')).toBeInTheDocument()
  })

  it('keeps the Stripe pay button disabled until the card entry is complete', async () => {
    isStripeConfigured.mockReturnValue(true)
    getStripe.mockResolvedValue({ id: 'stripe-instance' })

    renderForm()

    await screen.findByTestId('stripe-elements')
    const payBtn = screen.getByRole('button', { name: 'card.pay' })
    expect(payBtn).toBeDisabled()

    fireEvent.click(screen.getByTestId('card-element'))
    expect(payBtn).toBeEnabled()
  })

  it('confirms the card payment and reports success up (Req 6.4)', async () => {
    isStripeConfigured.mockReturnValue(true)
    getStripe.mockResolvedValue({ id: 'stripe-instance' })
    confirmCardPayment.mockResolvedValue({
      paymentIntent: { id: 'pi_1', status: 'succeeded' },
    })
    const onCardResult = vi.fn()

    renderForm({ onCardResult })

    await screen.findByTestId('stripe-elements')
    fireEvent.click(screen.getByTestId('card-element')) // mark complete
    fireEvent.click(screen.getByRole('button', { name: 'card.pay' }))

    await waitFor(() =>
      expect(onCardResult).toHaveBeenCalledWith({ status: 'succeeded', paymentIntentId: 'pi_1' }),
    )
    expect(confirmCardPayment).toHaveBeenCalledWith('pi_secret_123', {
      payment_method: { card: { id: 'card' } },
    })
  })

  it('reports failure up when Stripe declines the card (Req 6.6)', async () => {
    isStripeConfigured.mockReturnValue(true)
    getStripe.mockResolvedValue({ id: 'stripe-instance' })
    confirmCardPayment.mockResolvedValue({ error: { message: 'Card declined' } })
    const onCardResult = vi.fn()

    renderForm({ onCardResult })

    await screen.findByTestId('stripe-elements')
    fireEvent.click(screen.getByTestId('card-element'))
    fireEvent.click(screen.getByRole('button', { name: 'card.pay' }))

    await waitFor(() =>
      expect(onCardResult).toHaveBeenCalledWith({ status: 'failed', error: 'Card declined' }),
    )
  })

  it('renders the QR sub-form for bakong_qr and triggers onQrCheck when confirmed', () => {
    isStripeConfigured.mockReturnValue(false)
    const onQrCheck = vi.fn()

    renderForm({ method: 'bakong_qr', qr, onQrCheck })

    expect(screen.getByText('qr.scan')).toBeInTheDocument()
    expect(screen.getByAltText('Payment QR')).toBeInTheDocument()
    expect(screen.queryByTestId('card-element')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'qr.paid' }))
    expect(onQrCheck).toHaveBeenCalledTimes(1)
  })

  it('renders the QR sub-form for aba_qr', () => {
    isStripeConfigured.mockReturnValue(false)

    renderForm({ method: 'aba_qr', qr })

    expect(screen.getByAltText('Payment QR')).toBeInTheDocument()
  })

  it('disables the QR confirm button while processing', () => {
    isStripeConfigured.mockReturnValue(false)

    const { container } = renderForm({ method: 'aba_qr', qr, processing: true })

    const button = container.querySelector('button')
    expect(button).toBeDisabled()
  })
})
