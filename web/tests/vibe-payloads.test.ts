import { describe, expect, it } from 'vitest'

import {
  CONTENT_PAYLOAD_TYPES,
  ContentPayloadSchema,
  parseContentPayload,
} from '@/schemas/vibe-payloads'

/**
 * Payload contract tests.
 *
 * The fixtures below mirror what the agent's own normalisers produce
 * (agent/core.py: _norm_trip, _norm_hotel, _norm_guide, _norm_transport), so a
 * drift in either direction shows up here.
 */

const trip = {
  id: 'trip-1',
  name: 'Angkor Temple Discovery',
  description: 'Three days among the temples.',
  province: 'Siem Reap',
  durationDays: 3,
  priceUsd: 189,
  imageUrl: 'http://localhost:9000/derlg/trip-1.jpg',
  rating: 4.7,
  highlights: ['Angkor Wat', 'Bayon'],
  lat: 13.41,
  lng: 103.86,
}

const hotel = {
  id: 'hotel-1',
  name: 'Riverside Boutique',
  address: '12 River Road, Siem Reap',
  description: 'Quiet rooms near the old market.',
  priceUsd: 64,
  rating: 4.4,
  imageUrl: 'http://localhost:9000/derlg/hotel-1.jpg',
  lat: 13.35,
  lng: 103.85,
}

const guide = {
  id: 'guide-1',
  name: 'Sokha P.',
  pricePerDayUsd: 45,
  languages: ['en', 'zh'],
  specialities: ['temples'],
  province: 'Siem Reap',
  avatarUrl: 'http://localhost:9000/derlg/guide-1.jpg',
  isVerified: true,
  bio: 'Ten years guiding at Angkor.',
}

const transport = {
  id: 'veh-1',
  mode: 'van',
  operator: 'Mekong Express',
  priceUsd: 12,
  durationMinutes: 330,
  departureTime: '08:00',
}

/** The agent always attaches these, empty. */
const env = { actions: [], metadata: {} }

describe('card payload contract', () => {
  it('accepts a trip_cards block as the agent builds it', () => {
    const payload = parseContentPayload({ type: 'trip_cards', data: { trips: [trip] }, ...env })
    expect(payload?.type).toBe('trip_cards')
  })

  it('accepts a comparison block, which is what a two-result trip search emits', () => {
    // Verified in agent/core.py: payload_type = "comparison" if len(trips) == 2.
    const payload = parseContentPayload({
      type: 'comparison',
      data: { items: [trip, { ...trip, id: 'trip-2' }] },
      ...env,
    })
    expect(payload?.type).toBe('comparison')
    if (payload?.type === 'comparison') expect(payload.data.items).toHaveLength(2)
  })

  it('accepts hotel_cards, guide_cards and transport_options', () => {
    expect(parseContentPayload({ type: 'hotel_cards', data: { hotels: [hotel] }, ...env })).not.toBeNull()
    expect(parseContentPayload({ type: 'guide_cards', data: { guides: [guide] }, ...env })).not.toBeNull()
    expect(
      parseContentPayload({ type: 'transport_options', data: { options: [transport] }, ...env }),
    ).not.toBeNull()
  })

  it('keeps a guide name, which the agent supplies even though the REST API has none', () => {
    const payload = parseContentPayload({ type: 'guide_cards', data: { guides: [guide] }, ...env })
    if (payload?.type === 'guide_cards') expect(payload.data.guides[0]?.name).toBe('Sokha P.')
  })

  it('tolerates a vehicle mode the enum has never seen', () => {
    // A new server-side vehicle type must not invalidate the whole block.
    const payload = parseContentPayload({
      type: 'transport_options',
      data: { options: [{ ...transport, mode: 'hovercraft' }] },
      ...env,
    })
    expect(payload).not.toBeNull()
  })

  it('accepts blocks with no actions or metadata at all', () => {
    expect(parseContentPayload({ type: 'trip_cards', data: { trips: [trip] } })).not.toBeNull()
  })

  it('accepts optional fields being absent', () => {
    const minimal = { id: 't', name: 'Trip', priceUsd: 10 }
    expect(parseContentPayload({ type: 'trip_cards', data: { trips: [minimal] } })).not.toBeNull()
  })
})

describe('payload contract rejection', () => {
  it('rejects a block missing its required price', () => {
    const payload = parseContentPayload({
      type: 'trip_cards',
      data: { trips: [{ id: 't', name: 'Trip' }] },
    })
    expect(payload).toBeNull()
  })

  it('rejects a block whose data key is wrong', () => {
    // trip_cards keys on `trips`; `items` is the comparison spelling.
    expect(parseContentPayload({ type: 'trip_cards', data: { items: [trip] } })).toBeNull()
  })

  it('returns null for an unknown type instead of throwing', () => {
    expect(parseContentPayload({ type: 'holodeck_tour', data: {} })).toBeNull()
  })

  it('returns null for non-objects instead of throwing', () => {
    expect(parseContentPayload(null)).toBeNull()
    expect(parseContentPayload('trip_cards')).toBeNull()
    expect(parseContentPayload(42)).toBeNull()
  })
})

describe('booking and rich payload contract', () => {
  it('keeps bookingId on a qr_payment block', () => {
    /*
     * If the schema dropped bookingId, Zod would strip it and the cancel/retry
     * actions plus the agent's payment_completed flow would fire with undefined.
     */
    const payload = parseContentPayload({
      type: 'qr_payment',
      data: {
        qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?data=x',
        amount: { usd: 189 },
        expiry: '2026-08-01T10:00:00Z',
        paymentIntentId: 'pi_1',
        bookingId: 'bk_1',
      },
    })
    if (payload?.type === 'qr_payment') expect(payload.data.bookingId).toBe('bk_1')
  })

  it('accepts a stripe_card_form with no clientSecret, which is the real case', () => {
    // No backend endpoint mints a PaymentIntent, so clientSecret is never present.
    const payload = parseContentPayload({
      type: 'stripe_card_form',
      data: { bookingId: 'bk_1', amount: { usd: 189 } },
    })
    expect(payload).not.toBeNull()
    if (payload?.type === 'stripe_card_form') {
      expect(payload.data.clientSecret).toBeUndefined()
    }
  })

  it('constrains payment status to the states the backend reports', () => {
    const base = {
      paymentIntentId: 'pi_1',
      bookingId: 'bk_1',
      amountUsd: 189,
    }
    for (const status of ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED']) {
      expect(parseContentPayload({ type: 'payment_status', data: { ...base, status } })).not.toBeNull()
    }
    expect(
      parseContentPayload({ type: 'payment_status', data: { ...base, status: 'REFUNDED' } }),
    ).toBeNull()
  })

  it('accepts weather, itinerary, budget, gallery, map and text blocks', () => {
    const blocks: unknown[] = [
      {
        type: 'weather',
        data: { forecast: [{ date: '2026-08-02', high: 33, low: 25, condition: 'Sunny' }] },
      },
      { type: 'itinerary', data: { days: [{ day: 1, title: 'Arrive', activities: ['Check in'] }] } },
      { type: 'budget_estimate', data: { totalUsd: 480, breakdown: { accommodation: 200 } } },
      { type: 'image_gallery', data: { images: [{ url: 'http://x/1.jpg', caption: 'Bayon' }] } },
      {
        type: 'map_view',
        data: {
          center: { lat: 13.41, lng: 103.86 },
          markers: [{ id: 'm1', lat: 13.41, lng: 103.86, label: 'Angkor Wat' }],
        },
      },
      { type: 'text_summary', data: { text: 'Three days is enough for the main temples.' } },
    ]

    for (const block of blocks) expect(parseContentPayload(block)).not.toBeNull()
  })
})

describe('payload type registry', () => {
  it('lists exactly the types in the discriminated union', () => {
    const unionTypes = ContentPayloadSchema.options.map((option) => option.shape.type.value)
    expect([...CONTENT_PAYLOAD_TYPES].sort()).toEqual([...unionTypes].sort())
  })

  it('covers all 18 documented block types', () => {
    expect(CONTENT_PAYLOAD_TYPES).toHaveLength(18)
  })
})
