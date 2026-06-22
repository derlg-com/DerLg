import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-client', () => ({
  api: { post: vi.fn().mockResolvedValue({}) },
}))

import { api } from '@/lib/api-client'
import { getPaymentProvider, isMockPayments, PAYMENT_METHODS } from '@/lib/payments'

describe('lib/payments', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockClear().mockResolvedValue({})
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

  it('mock getQr returns a QR image url for each method', async () => {
    for (const method of PAYMENT_METHODS) {
      const qr = await getPaymentProvider().getQr({ bookingId: 'b1', method })
      expect(qr.qrImageUrl).toContain('api.qrserver.com')
    }
  })
})
