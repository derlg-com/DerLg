import { api } from './api-client'

export type PaymentMethod = 'card' | 'bakong_qr' | 'aba_qr'

export const PAYMENT_METHODS: PaymentMethod[] = ['card', 'bakong_qr', 'aba_qr']

export interface PaymentResult {
  status: 'succeeded' | 'failed'
  reference: string
}

export interface QrPayment {
  qrImageUrl: string
  reference: string
}

export interface PaymentProvider {
  readonly kind: 'mock' | 'rest'
  pay(input: { bookingId: string; method: PaymentMethod }): Promise<PaymentResult>
  getQr(input: { bookingId: string; method: PaymentMethod }): Promise<QrPayment>
}

/**
 * Default provider. The backend payments module does not exist yet, so this
 * simulates a successful charge / QR so the booking → checkout → confirmation
 * loop is demoable end-to-end. Swap to the REST provider once the backend lands.
 */
class MockPaymentProvider implements PaymentProvider {
  readonly kind = 'mock' as const

  pay({ bookingId, method }: { bookingId: string; method: PaymentMethod }): Promise<PaymentResult> {
    // Demo mode charges no card, but confirms the booking server-side so it
    // actually becomes CONFIRMED (My Trips, booking detail, and the ticket QR
    // reflect it). Backend errors (expired hold, DEMO_PAYMENTS disabled)
    // propagate to the checkout error handler.
    return new Promise<void>((resolve) => setTimeout(resolve, 500))
      .then(() => api.post(`/v1/bookings/${bookingId}/confirm`, { method }))
      .then(() => ({
        status: 'succeeded' as const,
        reference: `DEMO-${bookingId.slice(0, 8).toUpperCase()}`,
      }))
  }

  getQr({ bookingId }: { bookingId: string; method: PaymentMethod }): Promise<QrPayment> {
    const data = `DERLG-PAY-${bookingId}`
    return Promise.resolve({
      qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(data)}`,
      reference: data,
    })
  }
}

/**
 * Real provider against the backend `/v1/payments/*` contract. Gated OFF until
 * the backend payments module exists (set NEXT_PUBLIC_PAYMENTS_PROVIDER=rest).
 * Stripe Elements confirmation would be wired in the checkout card form.
 */
class RestPaymentProvider implements PaymentProvider {
  readonly kind = 'rest' as const

  async pay({ bookingId, method }: { bookingId: string; method: PaymentMethod }): Promise<PaymentResult> {
    // Until a real payments module + Stripe webhooks land, confirmation goes
    // through the gated booking-confirm endpoint.
    await api.post(`/v1/bookings/${bookingId}/confirm`, { method })
    return { status: 'succeeded', reference: bookingId }
  }

  async getQr({ bookingId }: { bookingId: string; method: PaymentMethod }): Promise<QrPayment> {
    const r = await api.post<{ qrCodeUrl: string; expiresAt: string }>('/v1/payments/qr', {
      bookingId,
      provider: 'bakong',
    })
    return { qrImageUrl: r.qrCodeUrl, reference: bookingId }
  }
}

const provider: PaymentProvider =
  process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER === 'rest'
    ? new RestPaymentProvider()
    : new MockPaymentProvider()

export function getPaymentProvider(): PaymentProvider {
  return provider
}

export function isMockPayments(): boolean {
  return provider.kind === 'mock'
}
