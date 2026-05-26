import { describe, it, expect } from 'vitest'
import { ContentPayloadSchema } from '@/schemas/vibe-booking'

describe('ContentPayloadSchema', () => {
  it('parses a valid trip_cards payload', () => {
    const result = ContentPayloadSchema.safeParse({
      type: 'trip_cards',
      data: {
        trips: [
          {
            id: 't1',
            name: 'Angkor Adventure',
            durationDays: 3,
            priceUsd: 250,
          },
        ],
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown content types', () => {
    const result = ContentPayloadSchema.safeParse({ type: 'unknown_type', data: {} })
    expect(result.success).toBe(false)
  })

  it('parses qr_payment with required fields', () => {
    const result = ContentPayloadSchema.safeParse({
      type: 'qr_payment',
      data: {
        qrUrl: 'https://qr.example.com/x',
        amount: { usd: 99 },
        expiry: '2026-01-01T00:00:00Z',
        paymentIntentId: 'pi_123',
      },
    })
    expect(result.success).toBe(true)
  })

  it('parses stripe_card_form payload', () => {
    const result = ContentPayloadSchema.safeParse({
      type: 'stripe_card_form',
      data: {
        bookingId: 'bk_1',
        amount: { usd: 100 },
      },
    })
    expect(result.success).toBe(true)
  })
})
