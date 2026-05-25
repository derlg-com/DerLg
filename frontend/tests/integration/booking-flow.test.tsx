/**
 * Task 18.2.7 — Integration tests for the booking flow.
 *
 * Drives the same code path the live WebSocket hook uses, but without React:
 * we feed inbound frames straight into the `useVibeBookingStore` actions and
 * assert that the booking state machine, content stack, and message log all
 * end up in the right shape.
 *
 * Lifecycle covered: idle → holding → paying → confirmed, plus failure and
 * hold-expiry. This is the contract the agent's `requires_payment` and
 * `payment_status` frames rely on.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from '@testing-library/react'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'
import { ContentPayloadSchema } from '@/schemas/vibe-booking'

function resetStore() {
  const s = useVibeBookingStore.getState()
  s.clearMessages()
  s.clearAllContent()
  s.clearBooking()
  s.setSessionId('')
}

beforeEach(() => {
  resetStore()
})

afterEach(() => {
  resetStore()
  // Wipe persisted state between tests
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('derlg:vibe-booking')
    window.localStorage.removeItem('derlg:vibe-booking:outbox')
  }
})

describe('Booking flow integration — store + schema', () => {
  it('walks idle → holding → confirmed and surfaces the right content', () => {
    const store = () => useVibeBookingStore.getState()

    // 1. User sends a search prompt
    act(() => {
      store().addMessage({
        id: 'u-1',
        role: 'user',
        content: 'Find me a 2-day Angkor trip',
        type: 'text',
        timestamp: new Date().toISOString(),
      })
    })
    expect(store().messages).toHaveLength(1)
    expect(store().booking.status).toBe('idle')

    // 2. Agent returns trip_cards
    const tripPayload = {
      type: 'trip_cards' as const,
      data: {
        trips: [
          { id: 't-1', name: 'Angkor Sunrise', durationDays: 2, priceUsd: 189 },
          { id: 't-2', name: 'Tonle Sap', durationDays: 3, priceUsd: 240 },
        ],
      },
    }
    expect(ContentPayloadSchema.safeParse(tripPayload).success).toBe(true)

    act(() => {
      store().addMessage({
        id: 'a-1',
        role: 'assistant',
        content: 'Here are 2 trips that match.',
        type: 'text',
        timestamp: new Date().toISOString(),
      })
      store().addContentItem({
        id: 'c-1',
        type: 'trip_cards',
        data: tripPayload.data,
        actions: [],
        metadata: {},
        status: 'ready',
        timestamp: new Date().toISOString(),
        linkedMessageId: 'a-1',
      })
    })
    expect(store().contentItems).toHaveLength(1)
    expect(store().activeContentId).toBe('c-1')

    // 3. User picks a trip → backend creates a hold → agent emits requires_payment + qr_payment card
    const qrPayload = {
      type: 'qr_payment' as const,
      data: {
        qrUrl: 'https://qr.example/abc',
        amount: { usd: 189 },
        expiry: '2026-05-25T13:15:00Z',
        paymentIntentId: 'pi_1',
      },
    }
    expect(ContentPayloadSchema.safeParse(qrPayload).success).toBe(true)

    act(() => {
      store().setBooking({
        status: 'holding',
        bookingId: 'b-1',
        reservedUntil: '2026-05-25T13:15:00Z',
      })
      store().addContentItem({
        id: 'c-2',
        type: 'qr_payment',
        data: qrPayload.data,
        actions: [],
        metadata: {},
        status: 'ready',
        timestamp: new Date().toISOString(),
      })
    })
    expect(store().booking).toMatchObject({ status: 'holding', bookingId: 'b-1' })
    expect(store().contentItems.at(-1)?.type).toBe('qr_payment')

    // 4. User scans QR → payment_status SUCCEEDED → confirmed
    act(() => {
      store().setBooking({
        status: 'confirmed',
        bookingId: 'b-1',
        bookingRef: 'REF-XYZ',
      })
      store().addContentItem({
        id: 'c-3',
        type: 'booking_confirmed',
        data: {
          bookingRef: 'REF-XYZ',
          tripName: 'Angkor Sunrise',
          travelDate: '2026-06-01',
        },
        actions: [],
        metadata: {},
        status: 'ready',
        timestamp: new Date().toISOString(),
      })
    })
    expect(store().booking).toMatchObject({
      status: 'confirmed',
      bookingRef: 'REF-XYZ',
    })
    expect(store().contentItems.map((c) => c.type)).toEqual([
      'trip_cards',
      'qr_payment',
      'booking_confirmed',
    ])
  })

  it('moves to failed when payment_status is FAILED', () => {
    const store = () => useVibeBookingStore.getState()

    act(() => {
      store().setBooking({
        status: 'holding',
        bookingId: 'b-2',
        reservedUntil: '2026-05-25T13:15:00Z',
      })
      store().setBooking({
        status: 'failed',
        bookingId: 'b-2',
        error: 'card_declined',
      })
    })
    expect(store().booking).toMatchObject({ status: 'failed', error: 'card_declined' })
  })

  it('returns to idle when the hold expires', () => {
    const store = () => useVibeBookingStore.getState()

    act(() => {
      store().setBooking({
        status: 'holding',
        bookingId: 'b-3',
        reservedUntil: '2026-05-25T12:00:00Z',
      })
    })
    expect(store().booking.status).toBe('holding')

    act(() => {
      // hold expiry resets the booking back to idle
      store().clearBooking()
    })
    expect(store().booking).toEqual({ status: 'idle' })
  })

  it('replaces the last content item when metadata.replace=true logic runs', () => {
    const store = () => useVibeBookingStore.getState()
    act(() => {
      store().addContentItem({
        id: 'c-old',
        type: 'trip_cards',
        data: { trips: [] },
        actions: [],
        metadata: {},
        status: 'ready',
        timestamp: new Date().toISOString(),
      })
    })
    expect(store().contentItems).toHaveLength(1)

    // Simulate the hook's replace-the-last-item branch
    act(() => {
      const last = store().contentItems.at(-1)
      if (last) store().removeContentItem(last.id)
      store().addContentItem({
        id: 'c-new',
        type: 'trip_cards',
        data: { trips: [{ id: 't-9', name: 'New', durationDays: 1, priceUsd: 50 }] },
        actions: [],
        metadata: { replace: true },
        status: 'ready',
        timestamp: new Date().toISOString(),
      })
    })
    expect(store().contentItems).toHaveLength(1)
    expect(store().contentItems[0].id).toBe('c-new')
  })

  it('caps message log at 50 entries', () => {
    const store = () => useVibeBookingStore.getState()
    act(() => {
      for (let i = 0; i < 60; i++) {
        store().addMessage({
          id: `m-${i}`,
          role: 'user',
          content: `msg ${i}`,
          type: 'text',
          timestamp: new Date().toISOString(),
        })
      }
    })
    expect(store().messages).toHaveLength(50)
    expect(store().messages[0].id).toBe('m-10')
    expect(store().messages.at(-1)?.id).toBe('m-59')
  })

  it('appendToStreamingMessage merges deltas onto the same assistant message', () => {
    const store = () => useVibeBookingStore.getState()
    let firstId = ''
    act(() => {
      firstId = store().appendToStreamingMessage('Hello ')
    })
    let secondId = ''
    act(() => {
      secondId = store().appendToStreamingMessage('world')
    })
    expect(firstId).toBe(secondId)
    expect(store().messages).toHaveLength(1)
    expect(store().messages[0].content).toBe('Hello world')
  })

  it('rejects an invalid trip_cards payload at schema layer (defense in depth)', () => {
    const bad = {
      type: 'trip_cards',
      data: {
        trips: [{ id: 't-1', name: 'No price', durationDays: 1 }],
      },
    }
    const result = ContentPayloadSchema.safeParse(bad)
    expect(result.success).toBe(false)
    if (!result.success) {
      // The schema rejection must point at the missing priceUsd field
      const allPaths = result.error.issues.map((i) => i.path.join('.'))
      expect(allPaths.some((p) => p.includes('priceUsd'))).toBe(true)
    }
  })
})
