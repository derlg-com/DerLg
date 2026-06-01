import { describe, it, expect } from 'vitest'
import { ContentPayloadSchema } from '@/schemas/vibe-booking'

describe('ContentPayloadSchema', () => {
  it('parses a valid trip_detail payload', () => {
    const result = ContentPayloadSchema.safeParse({
      type: 'trip_detail',
      data: {
        id: 't1', name: 'Cambodia Highlights', priceUsd: 599, durationDays: 5,
        description: 'temples', imageUrl: 'http://img/x.jpg', images: ['http://img/x.jpg'],
        included: ['Guide'], excluded: ['Flights'],
        itinerary: [{ day: 1, title: 'Arrive', description: 'pickup' }],
        lat: 13.3671, lng: 103.8448,
      },
    })
    expect(result.success).toBe(true)
  })

  it('parses a valid hotel_detail payload (price 0 ok)', () => {
    const result = ContentPayloadSchema.safeParse({
      type: 'hotel_detail',
      data: { id: 'h1', name: 'Riverside', priceUsd: 0, amenities: ['Pool'], lat: 13.36, lng: 103.85 },
    })
    expect(result.success).toBe(true)
  })

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
