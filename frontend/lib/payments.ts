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
  /** ISO timestamp the QR/payment session expires (tied to the 15-min hold). */
  expiresAt?: string | null
}

/**
 * Stripe PaymentIntent handle returned by the backend. The `clientSecret` is
 * browser-safe and required by `stripe.confirmCardPayment` to confirm the card
 * (including any 3D Secure step) directly from the client. No secret key ever
 * touches the browser.
 */
export interface PaymentIntent {
  clientSecret: string
  paymentIntentId: string
}

/** Lifecycle status of a payment, used to drive QR polling and card confirm. */
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'expired'

export interface PaymentStatusResult {
  status: PaymentStatus
  reference: string
}

export interface PaymentProvider {
  readonly kind: 'mock' | 'rest'
  /**
   * Confirm a non-card payment (or the mock demo charge). For card payments the
   * client confirms via Stripe directly (see {@link createPaymentIntent} +
   * `confirmCardPayment`); this remains for the QR / demo paths.
   */
  pay(input: { bookingId: string; method: PaymentMethod }): Promise<PaymentResult>
  /** Create (or fetch) a Stripe PaymentIntent so the card sub-form can confirm it. */
  createPaymentIntent(input: { bookingId: string; method: PaymentMethod }): Promise<PaymentIntent>
  /** Confirm the booking server-side after a successful Stripe card payment. */
  confirmCardSuccess(input: { bookingId: string; paymentIntentId: string }): Promise<PaymentResult>
  getQr(input: { bookingId: string; method: PaymentMethod }): Promise<QrPayment>
  /** Poll the current payment status for a booking (drives QR polling). */
  getStatus(input: { bookingId: string; method: PaymentMethod }): Promise<PaymentStatusResult>
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

  // In demo mode there is no real Stripe PaymentIntent. We hand back a sentinel
  // client secret so the card sub-form can branch to the demo charge instead of
  // calling Stripe (which is not configured here).
  createPaymentIntent({
    bookingId,
  }: {
    bookingId: string
    method: PaymentMethod
  }): Promise<PaymentIntent> {
    return Promise.resolve({
      clientSecret: `demo_secret_${bookingId}`,
      paymentIntentId: `demo_pi_${bookingId.slice(0, 8)}`,
    })
  }

  confirmCardSuccess({
    bookingId,
  }: {
    bookingId: string
    paymentIntentId: string
  }): Promise<PaymentResult> {
    return this.pay({ bookingId, method: 'card' })
  }

  getQr({ bookingId }: { bookingId: string; method: PaymentMethod }): Promise<QrPayment> {
    const data = `DERLG-PAY-${bookingId}`
    return Promise.resolve({
      qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(data)}`,
      reference: data,
      expiresAt: null,
    })
  }

  // Demo QR "pays" on the first poll so the demo loop completes without a real
  // banking app. The confirm call runs server-side via {@link pay}.
  getStatus({
    bookingId,
  }: {
    bookingId: string
    method: PaymentMethod
  }): Promise<PaymentStatusResult> {
    return this.pay({ bookingId, method: 'bakong_qr' }).then((r) => ({
      status: r.status === 'succeeded' ? ('paid' as const) : ('failed' as const),
      reference: r.reference,
    }))
  }
}

/**
 * Real provider against the backend `/v1/payments/*` contract. Gated OFF until
 * the backend payments module exists (set NEXT_PUBLIC_PAYMENTS_PROVIDER=rest).
 * Card confirmation runs client-side via Stripe `confirmCardPayment` using the
 * `clientSecret` from {@link createPaymentIntent}; the backend webhook is the
 * source of truth, and {@link confirmCardSuccess} reconciles the booking.
 */
class RestPaymentProvider implements PaymentProvider {
  readonly kind = 'rest' as const

  async pay({
    bookingId,
    method,
  }: {
    bookingId: string
    method: PaymentMethod
  }): Promise<PaymentResult> {
    // Non-card confirmation (e.g. demo/QR fallback) goes through the gated
    // booking-confirm endpoint until a full payments module + webhooks land.
    await api.post(`/v1/bookings/${bookingId}/confirm`, { method })
    return { status: 'succeeded', reference: bookingId }
  }

  async createPaymentIntent({
    bookingId,
    method,
  }: {
    bookingId: string
    method: PaymentMethod
  }): Promise<PaymentIntent> {
    const r = await api.post<{ clientSecret: string; paymentIntentId: string }>(
      '/v1/payments/intent',
      { bookingId, method },
      // PaymentIntent creation must be idempotent so a retry never double-charges.
      { idempotencyKey: `pi-${bookingId}` },
    )
    return { clientSecret: r.clientSecret, paymentIntentId: r.paymentIntentId }
  }

  async confirmCardSuccess({
    bookingId,
    paymentIntentId,
  }: {
    bookingId: string
    paymentIntentId: string
  }): Promise<PaymentResult> {
    await api.post(`/v1/payments/confirm`, { bookingId, paymentIntentId })
    return { status: 'succeeded', reference: paymentIntentId }
  }

  async getQr({
    bookingId,
    method,
  }: {
    bookingId: string
    method: PaymentMethod
  }): Promise<QrPayment> {
    const r = await api.post<{ qrCodeUrl: string; reference?: string; expiresAt?: string }>(
      '/v1/payments/qr',
      { bookingId, provider: method === 'aba_qr' ? 'aba' : 'bakong' },
    )
    return {
      qrImageUrl: r.qrCodeUrl,
      reference: r.reference ?? bookingId,
      expiresAt: r.expiresAt ?? null,
    }
  }

  async getStatus({
    bookingId,
  }: {
    bookingId: string
    method: PaymentMethod
  }): Promise<PaymentStatusResult> {
    const r = await api.get<{ status: PaymentStatus; reference?: string }>(
      `/v1/payments/${bookingId}/status`,
    )
    return { status: r.status, reference: r.reference ?? bookingId }
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

/** True for a demo client secret minted by the mock provider (no real Stripe). */
export function isDemoClientSecret(clientSecret: string | null | undefined): boolean {
  return typeof clientSecret === 'string' && clientSecret.startsWith('demo_secret_')
}
