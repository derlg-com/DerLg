import { describe, expect, it } from 'vitest'

import {
  googleMapsDirectionsUrl,
  googleMapsPlaceUrl,
  googleMapsRouteUrl,
  hasCoordinates,
  haversineKm,
  PHNOM_PENH,
} from '@/lib/maps/google'
import { deriveWorkspace, workspacePoints, type WorkspaceState } from '@/lib/vibe/workspace'
import type { AgentTurn, Turn } from '@/lib/vibe/transcript'

/**
 * Workspace derivation and Google Maps handoff.
 *
 * The workspace is the one place the UI claims to know "what is true right now",
 * so the rules that matter are the CONFLICT rules: which turn wins, what a later
 * payment update is allowed to overwrite, and what must never be invented.
 */

function agentTurn(id: string, blocks: unknown[]): AgentTurn {
  return {
    kind: 'agent',
    id,
    text: '',
    blocks: blocks as AgentTurn['blocks'],
    suggestions: [],
  }
}

const tripCards = {
  type: 'trip_cards',
  data: {
    trips: [
      { id: 't1', name: 'Bokor Mountain Escape', priceUsd: 120, durationDays: 2 },
      { id: 't2', name: 'Kampot Relaxing Escape', priceUsd: 95, durationDays: 2 },
    ],
  },
}

const tripDetail = {
  type: 'trip_detail',
  data: {
    id: 't1',
    name: 'Bokor Mountain Escape',
    priceUsd: 120,
    durationDays: 2,
    lat: 10.6,
    lng: 104.05,
    images: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'],
    itinerary: [
      { day: 1, title: 'Drive up Bokor', description: 'Sunset at the plateau' },
      { day: 2, title: 'Kampot riverside' },
    ],
  },
}

const hotelDetail = {
  type: 'hotel_detail',
  data: { id: 'h9', name: 'Riverside Boutique', priceUsd: 48, lat: 10.61, lng: 104.18 },
}

const bookingSummary = {
  type: 'booking_summary',
  data: {
    bookingId: 'b1',
    itemType: 'trip',
    itemName: 'Bokor Mountain Escape',
    travelDate: '2026-02-01',
    peopleCount: 2,
    priceBreakdown: [{ label: 'Total', amountUsd: 240 }],
    totalUsd: 240,
    holdExpiresAt: '2026-02-01T10:15:00.000Z',
  },
}

const qrPayment = {
  type: 'qr_payment',
  data: {
    qrUrl: 'https://cdn.test/qr.png',
    amount: { usd: 240 },
    expiry: '2026-02-01T10:15:00.000Z',
    paymentIntentId: 'pi_1',
    bookingId: 'b1',
  },
}

describe('deriveWorkspace', () => {
  it('is empty for a transcript with no blocks', () => {
    const turns: Turn[] = [
      { kind: 'user', id: 'u1', text: 'hello' },
      agentTurn('a1', []),
    ]

    const state = deriveWorkspace(turns)
    expect(state.hasContent).toBe(false)
    expect(state.subject).toBeUndefined()
  })

  it('counts the options a card block put on the table', () => {
    const state = deriveWorkspace([agentTurn('a1', [tripCards])])

    expect(state.options).toEqual({ kind: 'trip', count: 2 })
    // Cards are a choice, not a selection — nothing is the subject yet.
    expect(state.subject).toBeUndefined()
    expect(state.hasContent).toBe(true)
  })

  it('treats a comparison block as options too', () => {
    const state = deriveWorkspace([
      agentTurn('a1', [{ type: 'comparison', data: { items: tripCards.data.trips } }]),
    ])

    expect(state.options).toEqual({ kind: 'trip', count: 2 })
  })

  it('promotes a trip detail to the subject, with its itinerary and photos', () => {
    const state = deriveWorkspace([agentTurn('a1', [tripDetail])])

    expect(state.subject).toMatchObject({
      kind: 'trip',
      id: 't1',
      name: 'Bokor Mountain Escape',
      priceUnit: 'perPerson',
      href: '/trips/t1',
    })
    // One tool call fills three slots rather than leaving the panel half-empty.
    expect(state.itinerary?.days).toHaveLength(2)
    expect(state.gallery?.images.map((i) => i.url)).toEqual([
      'https://cdn.test/a.jpg',
      'https://cdn.test/b.jpg',
    ])
  })

  it('lets the newest turn replace the subject', () => {
    const state = deriveWorkspace([
      agentTurn('a1', [tripDetail]),
      agentTurn('a2', [hotelDetail]),
    ])

    expect(state.subject?.id).toBe('h9')
    expect(state.subject?.priceUnit).toBe('perNight')
  })

  it('keeps a custom trip as the subject with a total price, not a per-person one', () => {
    const state = deriveWorkspace([
      agentTurn('a1', [
        {
          type: 'custom_trip_card',
          data: {
            id: 'c1',
            title: '3-day Siem Reap custom',
            durationDays: 3,
            totalUsd: 512,
            items: [{ type: 'hotel_room', name: 'Deluxe', unitPriceUsd: 60, quantity: 3 }],
          },
        },
      ]),
    ])

    expect(state.subject).toMatchObject({ kind: 'custom_trip', priceUnit: 'total', priceUsd: 512 })
  })

  it('carries the hold with the fields the renderer shows', () => {
    const state = deriveWorkspace([agentTurn('a1', [bookingSummary])])

    expect(state.hold).toEqual({
      bookingId: 'b1',
      itemName: 'Bokor Mountain Escape',
      travelDate: '2026-02-01',
      peopleCount: 2,
      totalUsd: 240,
      holdExpiresAt: '2026-02-01T10:15:00.000Z',
    })
  })

  it('keeps the QR image when a later payment_status updates the same payment', () => {
    const state = deriveWorkspace([
      agentTurn('a1', [qrPayment]),
      agentTurn('a2', [
        {
          type: 'payment_status',
          data: {
            paymentIntentId: 'pi_1',
            bookingId: 'b1',
            status: 'PENDING',
            amountUsd: 240,
          },
        },
      ]),
    ])

    expect(state.payment?.status).toBe('PENDING')
    // Blanking the code mid-scan would be a regression, not an update.
    expect(state.payment?.qrUrl).toBe('https://cdn.test/qr.png')
  })

  it('does not attach a stale QR code from a different payment attempt', () => {
    const state = deriveWorkspace([
      agentTurn('a1', [qrPayment]),
      agentTurn('a2', [
        {
          type: 'payment_status',
          data: {
            paymentIntentId: 'pi_2',
            bookingId: 'b2',
            status: 'PENDING',
            amountUsd: 99,
          },
        },
      ]),
    ])

    expect(state.payment?.paymentIntentId).toBe('pi_2')
    expect(state.payment?.qrUrl).toBeUndefined()
  })

  it('lets the newest status win over an older one', () => {
    const older = {
      type: 'payment_status',
      data: { paymentIntentId: 'pi_1', bookingId: 'b1', status: 'PENDING', amountUsd: 240 },
    }
    const newer = {
      type: 'payment_status',
      data: { paymentIntentId: 'pi_1', bookingId: 'b1', status: 'SUCCEEDED', amountUsd: 240 },
    }

    const state = deriveWorkspace([agentTurn('a1', [older]), agentTurn('a2', [newer])])
    expect(state.payment?.status).toBe('SUCCEEDED')
  })

  it('never lets an older SUCCEEDED status attach to a newer unpaid payment', () => {
    /*
     * The worst possible failure of this module: the panel would hide a live QR
     * code and announce "payment successful" for a booking nobody has paid.
     */
    const state = deriveWorkspace([
      agentTurn('a1', [
        {
          type: 'payment_status',
          data: { paymentIntentId: 'pi_OLD', bookingId: 'b_OLD', status: 'SUCCEEDED', amountUsd: 10 },
        },
      ]),
      agentTurn('a2', [
        {
          type: 'qr_payment',
          data: {
            qrUrl: 'https://cdn.test/new-qr.png',
            amount: { usd: 500 },
            expiry: '2026-02-01T10:15:00.000Z',
            paymentIntentId: 'pi_NEW',
            bookingId: 'b_NEW',
          },
        },
      ]),
    ])

    expect(state.payment?.paymentIntentId).toBe('pi_NEW')
    expect(state.payment?.bookingId).toBe('b_NEW')
    expect(state.payment?.status).toBeUndefined()
    expect(state.payment?.amountUsd).toBe(500)
    expect(state.payment?.qrUrl).toBe('https://cdn.test/new-qr.png')
  })

  it('does not let a newer subject inherit an older one\u2019s photos, itinerary or map', () => {
    /*
     * "Show me the other hotel" must not leave the first hotel's photos and route
     * on screen under the second hotel's name.
     */
    const state = deriveWorkspace([
      agentTurn('a1', [
        tripDetail,
        { type: 'map_view', data: { center: { lat: 10.6, lng: 104 }, markers: [{ id: 'm1', lat: 10.6, lng: 104 }] } },
      ]),
      // A newer subject that carries no photos, no itinerary and no map of its own.
      agentTurn('a2', [
        { type: 'hotel_detail', data: { id: 'h9', name: 'Riverside Boutique', priceUsd: 48 } },
      ]),
    ])

    expect(state.subject?.id).toBe('h9')
    expect(state.gallery).toBeUndefined()
    expect(state.itinerary).toBeUndefined()
    expect(state.map).toBeUndefined()
  })

  it('still accepts a map and gallery emitted alongside the newest subject', () => {
    const state = deriveWorkspace([
      agentTurn('a1', [hotelDetail]),
      agentTurn('a2', [
        tripDetail,
        { type: 'map_view', data: { center: { lat: 10.6, lng: 104 }, markers: [{ id: 'm1', lat: 10.6, lng: 104 }] } },
      ]),
    ])

    expect(state.subject?.id).toBe('t1')
    expect(state.map?.markers).toHaveLength(1)
    expect(state.gallery?.images).toHaveLength(2)
  })

  it('does not stamp a failed attempt onto a retry of the same booking', () => {
    /*
     * Attempt one fails, a new code is issued for the SAME booking. The two share
     * a booking id but are different payments, so the old FAILED status must not
     * describe the live code.
     */
    const state = deriveWorkspace([
      agentTurn('a1', [
        {
          type: 'payment_status',
          data: { paymentIntentId: 'pi_1', bookingId: 'b1', status: 'FAILED', amountUsd: 240 },
        },
      ]),
      agentTurn('a2', [
        {
          type: 'qr_payment',
          data: {
            qrUrl: 'https://cdn.test/retry-qr.png',
            amount: { usd: 240 },
            expiry: '2026-02-01T10:15:00.000Z',
            paymentIntentId: 'pi_2',
            bookingId: 'b1',
          },
        },
      ]),
    ])

    expect(state.payment?.paymentIntentId).toBe('pi_2')
    expect(state.payment?.status).toBeUndefined()
    expect(state.payment?.qrUrl).toBe('https://cdn.test/retry-qr.png')
  })

  it('falls back to the booking id when a block carries no intent id', () => {
    // stripe_card_form defaults paymentIntentId to '' because nothing mints one.
    const state = deriveWorkspace([
      agentTurn('a1', [
        {
          type: 'stripe_card_form',
          data: { bookingId: 'b1', amount: { usd: 240 }, expiry: '2026-02-01T10:15:00.000Z' },
        },
      ]),
      agentTurn('a2', [
        {
          type: 'payment_status',
          data: { paymentIntentId: 'pi_9', bookingId: 'b1', status: 'SUCCEEDED', amountUsd: 240 },
        },
      ]),
    ])

    // The status is newest, so it owns the slot outright.
    expect(state.payment?.status).toBe('SUCCEEDED')
    expect(state.payment?.bookingId).toBe('b1')
  })

  it('drops a map that describes a different turn than the subject', () => {
    /*
     * The agent derives map_view from the cards in the SAME turn. A newer hotel
     * search therefore produces a map of hotels — showing it under an older trip's
     * heading would put the wrong pins beneath the subject's name.
     */
    const state = deriveWorkspace([
      agentTurn('a1', [tripDetail]),
      agentTurn('a2', [
        {
          type: 'hotel_cards',
          data: { hotels: [{ id: 'h1', name: 'Riverside', priceUsd: 40 }] },
        },
        {
          type: 'map_view',
          data: { center: { lat: 11.5, lng: 104.9 }, markers: [{ id: 'h1', lat: 11.5, lng: 104.9 }] },
        },
      ]),
    ])

    expect(state.subject?.id).toBe('t1')
    expect(state.map).toBeUndefined()
    // The subject's own coordinate still drives the Google Maps links.
    expect(workspacePoints(state)).toEqual([{ lat: 10.6, lng: 104.05 }])
  })

  it('keeps a map that came from the subject\u2019s own turn', () => {
    const state = deriveWorkspace([
      agentTurn('a1', [
        tripDetail,
        {
          type: 'map_view',
          data: { center: { lat: 10.6, lng: 104.05 }, markers: [{ id: 'm1', lat: 10.6, lng: 104.05 }] },
        },
      ]),
    ])

    expect(state.map?.markers).toHaveLength(1)
  })

  it('never shows a hold and a payment for different bookings together', () => {
    /*
     * The money case. Hold A, then a QR for A, then hold B: without reconciliation
     * B's total sits above A's live scannable code, and someone reads the amount
     * from B while paying A. Irreversible, so the payment wins and the hold goes.
     */
    const holdFor = (bookingId: string, totalUsd: number) => ({
      type: 'booking_summary',
      data: {
        bookingId,
        itemType: 'trip',
        itemName: `Trip ${bookingId}`,
        travelDate: '2026-02-01',
        peopleCount: 1,
        priceBreakdown: [{ label: 'Total', amountUsd: totalUsd }],
        totalUsd,
      },
    })

    const state = deriveWorkspace([
      agentTurn('a1', [holdFor('bA', 100)]),
      agentTurn('a2', [qrPayment]),
      agentTurn('a3', [holdFor('bB', 900)]),
    ])

    expect(state.payment?.bookingId).toBe('b1')
    expect(state.hold).toBeUndefined()
  })

  it('keeps the hold when it is the same booking as the payment', () => {
    const state = deriveWorkspace([
      agentTurn('a1', [bookingSummary]),
      agentTurn('a2', [qrPayment]),
    ])

    expect(state.hold?.bookingId).toBe('b1')
    expect(state.payment?.bookingId).toBe('b1')
  })

  it('surfaces a confirmation once the agent emits one', () => {
    const state = deriveWorkspace([
      agentTurn('a1', [qrPayment]),
      agentTurn('a2', [
        {
          type: 'booking_confirmed',
          data: {
            bookingRef: 'DLG-2026-12345',
            tripName: 'Bokor Mountain Escape',
            travelDate: '2026-02-01',
          },
        },
      ]),
    ])

    expect(state.confirmation?.bookingRef).toBe('DLG-2026-12345')
  })

  it('ignores malformed blocks instead of throwing', () => {
    const state = deriveWorkspace([
      agentTurn('a1', [{ type: 'trip_detail', data: { id: 't1' } }, tripCards]),
    ])

    // The detail is missing required fields, so only the valid cards register.
    expect(state.subject).toBeUndefined()
    expect(state.options).toEqual({ kind: 'trip', count: 2 })
  })

  it('does not treat transient blocks as durable state', () => {
    const state = deriveWorkspace([
      agentTurn('a1', [
        { type: 'weather', data: { forecast: [{ date: 'x', high: 32, low: 24, condition: 'Sun' }] } },
        { type: 'budget_estimate', data: { totalUsd: 300, breakdown: { food: 90 } } },
      ]),
    ])

    expect(state.hasContent).toBe(false)
  })

  it('drops a map block with no markers', () => {
    const state = deriveWorkspace([
      agentTurn('a1', [{ type: 'map_view', data: { center: { lat: 11, lng: 104 }, markers: [] } }]),
    ])

    expect(state.map).toBeUndefined()
  })
})

describe('workspacePoints', () => {
  it('prefers the map markers over the subject coordinate', () => {
    const state: WorkspaceState = {
      hasContent: true,
      subject: {
        kind: 'trip',
        id: 't1',
        name: 'Trip',
        priceUsd: 1,
        priceUnit: 'perPerson',
        lat: 1,
        lng: 2,
      },
      map: {
        center: { lat: 10, lng: 104 },
        markers: [{ id: 'm1', lat: 10.6, lng: 104.05 }],
      },
    }

    expect(workspacePoints(state)).toEqual([{ lat: 10.6, lng: 104.05 }])
  })

  it('falls back to the subject coordinate, and to nothing at all', () => {
    expect(
      workspacePoints({
        hasContent: true,
        subject: {
          kind: 'hotel',
          id: 'h1',
          name: 'H',
          priceUsd: 1,
          priceUnit: 'perNight',
          lat: 11.5,
          lng: 104.9,
        },
      }),
    ).toEqual([{ lat: 11.5, lng: 104.9 }])

    expect(workspacePoints({ hasContent: false })).toEqual([])
  })
})

describe('hasCoordinates', () => {
  it('rejects the null island, non-finite values and out-of-range pairs', () => {
    expect(hasCoordinates({ lat: 0, lng: 0 })).toBe(false)
    expect(hasCoordinates({ lat: Number.NaN, lng: 104 })).toBe(false)
    expect(hasCoordinates({ lat: 91, lng: 104 })).toBe(false)
    expect(hasCoordinates(undefined)).toBe(false)
    expect(hasCoordinates({ lat: 11.5564, lng: 104.9282 })).toBe(true)
  })
})

describe('google maps urls', () => {
  it('builds a keyless place link from a coordinate', () => {
    const url = googleMapsPlaceUrl({ lat: 10.6, lng: 104.05 })
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=10.6%2C104.05')
    // No key means nothing to leak and no quota to exhaust.
    expect(url).not.toMatch(/key=/)
  })

  it('scopes a name-only search to Cambodia so it cannot resolve elsewhere', () => {
    const url = googleMapsPlaceUrl(null, 'Bokor Mountain')
    expect(url).toContain('query=Bokor+Mountain%2C+Cambodia')
  })

  it('returns null when there is neither a coordinate nor a name', () => {
    expect(googleMapsPlaceUrl(null)).toBeNull()
    expect(googleMapsPlaceUrl({ lat: 0, lng: 0 }, '  ')).toBeNull()
  })

  it('omits the origin when unknown, so the device location is used', () => {
    const url = googleMapsDirectionsUrl({ lat: 10.6, lng: 104.05 })
    expect(url).toContain('destination=10.6%2C104.05')
    expect(url).not.toContain('origin=')
  })

  it('accepts an origin as a coordinate or a place name', () => {
    expect(googleMapsDirectionsUrl({ lat: 10.6, lng: 104.05 }, { origin: PHNOM_PENH })).toContain(
      'origin=11.5564%2C104.9282',
    )
    expect(
      googleMapsDirectionsUrl({ lat: 10.6, lng: 104.05 }, { origin: 'Phnom Penh' }),
    ).toContain('origin=Phnom+Penh%2C+Cambodia')
  })

  it('turns several markers into a route with capped waypoints', () => {
    const points = Array.from({ length: 12 }, (_, i) => ({ lat: 11 + i / 100, lng: 104 }))
    const url = googleMapsRouteUrl(points)

    expect(url).toContain('origin=11%2C104')
    expect(url).toContain('destination=11.11%2C104')
    // Google's URL API documents an 8-waypoint cap; more would be silently dropped.
    expect(url?.match(/%7C/g)?.length).toBe(7)
  })

  it('degrades a single-marker route to a place link', () => {
    expect(googleMapsRouteUrl([{ lat: 10.6, lng: 104.05 }])).toContain('/maps/search/')
    expect(googleMapsRouteUrl([{ lat: 0, lng: 0 }])).toBeNull()
  })
})

describe('haversineKm', () => {
  it('measures Phnom Penh to Kampot as a straight line, not a driving distance', () => {
    const kampot = { lat: 10.6104, lng: 104.1817 }
    const km = haversineKm(PHNOM_PENH, kampot)
    // ~133km straight line; the drive is ~148km, which is why this is not a route.
    expect(km).toBeGreaterThan(125)
    expect(km).toBeLessThan(140)
  })

  it('is zero for the same point', () => {
    expect(haversineKm(PHNOM_PENH, PHNOM_PENH)).toBe(0)
  })
})
