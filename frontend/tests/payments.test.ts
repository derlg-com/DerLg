import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-client', () => ({
  api: { post: vi.fn().mockResolvedValue({}), get: vi.fn().mockResolvedValue({}) },
}))

import { api } from '@/lib/api-client'
import {
  getPaymentProvider,
  isMockPayments,
  isDemoClientSecret,
  PAYMENT_METHODS,
} from '@/lib/payments'

describe('lib/payments', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockClear().mockResolvedValue({})
    vi.mocked(api.get).mockClear().mockResolvedValue({})
  })

  it('defaults to the mock provider', () => {
    expect(isMockPayments()).toBe(true)
    expect(getPaymentProvider().kind).toBe('mock')
  })

  it('mock pay confirms the booking via the backend and resolves succeeded', async () => {
    const result = await getPaymentProvider().pay({ bookingId: 'abcdef12-3456', method: 'card' })
    expect(api.post).toHaveBeenCalledWith('/v1/bookings/abcdef12-3456/confirm', { method: 'card' })
    expect(result.status).toBe('succeeded')
    expect(result.reference).toContain('DEMO-')
  })

  it('mock createPaymentIntent returns a demo client secret (no real Stripe)', async () => {
    const pi = await getPaymentProvider().createPaymentIntent({ bookingId: 'b1', method: 'card' })
    expect(isDemoClientSecret(pi.clientSecret)).toBe(true)
    expect(pi.paymentIntentId).toContain('demo_pi_')
  })

  it('isDemoClientSecret distinguishes demo from real secrets', () => {
    expect(isDemoClientSecret('demo_secret_b1')).toBe(true)
    expect(isDemoClientSecret('pi_123_secret_456')).toBe(false)
    expect(isDemoClientSecret(null)).toBe(false)
  })

  it('mock confirmCardSuccess confirms the booking and resolves succeeded', async () => {
    const result = await getPaymentProvider().confirmCardSuccess({
      bookingId: 'b1',
      paymentIntentId: 'pi_1',
    })
    expect(api.post).toHaveBeenCalledWith('/v1/bookings/b1/confirm', { method: 'card' })
    expect(result.status).toBe('succeeded')
  })

  it('mock getStatus reports paid after confirming the booking (demo QR loop)', async () => {
    const status = await getPaymentProvider().getStatus({ bookingId: 'b1', method: 'bakong_qr' })
    expect(api.post).toHaveBeenCalledWith('/v1/bookings/b1/confirm', { method: 'bakong_qr' })
    expect(status.status).toBe('paid')
  })

  it('mock getQr returns a QR image url for each method', async () => {
    for (const method of PAYMENT_METHODS) {
      const qr = await getPaymentProvider().getQr({ bookingId: 'b1', method })
      expect(qr.qrImageUrl).toContain('api.qrserver.com')
    }
  })
})
