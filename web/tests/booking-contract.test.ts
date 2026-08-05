import { describe, expect, it } from 'vitest'

import {
  BOOKING_STATUSES,
  BookingSchema,
  RefundResultSchema,
  isAwaitingPayment,
  isCancellable,
  previewRefundPercentage,
  toStatusFilter,
} from '@/schemas/booking'

/**
 * Booking contract tests.
 *
 * The fixture below is a REAL response captured from the live API (a trip booking
 * created, confirmed and cancelled during development), so a server-side change to
 * these shapes shows up here.
 */
const liveBooking = {
  id: 'f06a0ee3-177b-4ae9-995b-85605b88aed0',
  reference: 'TRP-XHATX7',
  type: 'trip',
  name: 'Southern Beach Escape',
  coverImageUrl: 'http://localhost:9000/derlg-storage/trips/beach-escape.jpg',
  location: 'Sihanoukville International Airport',
  startDate: '2026-09-12',
  endDate: '2026-09-15',
  status: 'HOLD',
  totalPriceUsd: 1197,
  holdExpiresAt: '2026-08-01T09:09:55.194Z',
  specialRequests: 'Vegetarian',
  refundAmountUsd: null,
  cancelledAt: null,
  userId: 'da345cbc-14be-4c3d-9d31-beef4ce51621',
  method: 'single_resource',
  singleResourceKind: 'trip',
  tripTemplateId: null,
  subtotalUsd: 1197,
  discountUsd: 0,
  refundPercentage: null,
  qrCodeUrl: null,
  createdAt: '2026-08-01T08:54:55.199Z',
  updatedAt: '2026-08-01T08:54:55.199Z',
  items: [
    {
      id: '318a9aae-0423-421e-81c3-9e65c60e216e',
      name: 'Southern Beach Escape',
      bookingType: 'trip_package',
      resourceId: '860b4d50-0d09-441a-95ba-4a4146ff3aa6',
      startDate: '2026-09-12',
      endDate: '2026-09-15',
      quantity: 3,
      unitPriceUsd: 399,
      totalPriceUsd: 1197,
      subtotalUsd: 1197,
      snapshot: { name: 'Southern Beach Escape', category: 'nature', durationDays: 4 },
    },
  ],
}

describe('booking schema', () => {
  it('parses a real hold response', () => {
    const booking = BookingSchema.parse(liveBooking)
    expect(booking.status).toBe('HOLD')
    expect(booking.reference).toBe('TRP-XHATX7')
    expect(booking.holdExpiresAt).toBeTruthy()
  })

  it('accepts the explicit nulls the API sends before confirmation', () => {
    const booking = BookingSchema.parse(liveBooking)
    expect(booking.qrCodeUrl).toBeNull()
    expect(booking.refundPercentage).toBeNull()
    expect(booking.cancelledAt).toBeNull()
  })

  it('keeps the item snapshot, which carries the resource copy at booking time', () => {
    const booking = BookingSchema.parse(liveBooking)
    expect(booking.items?.[0]?.snapshot).toBeTruthy()
  })

  it('charges children at the full per-person rate', () => {
    /*
     * Verified live: 2 adults + 1 child on a $399 trip produced quantity 3 and a
     * $1197 total. A quantity of 2 here would mean the UI under-quotes the price.
     */
    const booking = BookingSchema.parse(liveBooking)
    expect(booking.items?.[0]?.quantity).toBe(3)
    expect(booking.totalPriceUsd).toBe(399 * 3)
  })

  it('parses a confirmed booking with its ticket QR', () => {
    const booking = BookingSchema.parse({
      ...liveBooking,
      status: 'CONFIRMED',
      qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=DERLG-TICKET-TRP-XHATX7',
    })
    expect(booking.status).toBe('CONFIRMED')
    expect(booking.qrCodeUrl).toContain('DERLG-TICKET')
  })

  it('tolerates a field the server adds later', () => {
    // A wide bookkeeping payload must not break parsing when it grows.
    expect(() => BookingSchema.parse({ ...liveBooking, loyaltyPointsEarned: 240 })).not.toThrow()
  })

  it('rejects a response missing its reference', () => {
    const { reference: _omitted, ...broken } = liveBooking
    expect(() => BookingSchema.parse(broken)).toThrow()
  })
})

describe('cancellation response', () => {
  it('parses the refund-only shape the API actually returns', () => {
    /*
     * Cancelling returns ONLY the refund — never the updated booking — so callers
     * have to refetch. Asserting the narrow shape keeps that fact visible.
     */
    const refund = RefundResultSchema.parse({
      refundAmountUsd: 399,
      refundPercentage: 100,
      refundMethod: null,
    })
    expect(refund.refundAmountUsd).toBe(399)
    expect(refund).not.toHaveProperty('status')
  })
})

describe('status filter casing', () => {
  it('lowercases a status for the query parameter', () => {
    /*
     * Verified live: `?status=CANCELLED` returns 400 listing the lowercase values,
     * while responses are uppercase. Echoing a status straight back would fail.
     */
    expect(toStatusFilter('CANCELLED')).toBe('cancelled')
    expect(toStatusFilter('PENDING_PAYMENT')).toBe('pending_payment')
  })

  it('covers every status the API can report', () => {
    expect(BOOKING_STATUSES).toHaveLength(8)
    expect(BOOKING_STATUSES).toContain('PAYMENT_FAILED')
    expect(BOOKING_STATUSES).toContain('NO_SHOW')
  })
})

describe('payment and cancellation state', () => {
  it('treats holds and failed payments as still awaiting payment', () => {
    expect(isAwaitingPayment('HOLD')).toBe(true)
    expect(isAwaitingPayment('PENDING_PAYMENT')).toBe(true)
    // The server allows re-confirming after a failure.
    expect(isAwaitingPayment('PAYMENT_FAILED')).toBe(true)
  })

  it('does not ask for payment on a settled booking', () => {
    for (const status of ['CONFIRMED', 'CANCELLED', 'EXPIRED', 'COMPLETED', 'NO_SHOW']) {
      expect(isAwaitingPayment(status)).toBe(false)
    }
  })

  it('allows cancelling only what is still live', () => {
    expect(isCancellable('HOLD')).toBe(true)
    expect(isCancellable('CONFIRMED')).toBe(true)
    expect(isCancellable('CANCELLED')).toBe(false)
    expect(isCancellable('EXPIRED')).toBe(false)
  })
})

describe('refund preview', () => {
  const now = new Date('2026-08-01T10:00:00Z')

  /**
   * These boundaries mirror the SERVER's computeRefund, not the product copy that
   * shipped with the message catalogue. The catalogue previously promised 50% down
   * to one day before departure; the server pays 0% from three days out.
   */
  it('gives 100% more than seven days ahead', () => {
    expect(previewRefundPercentage('2026-08-10', now)).toBe(100)
    expect(previewRefundPercentage('2026-09-12', now)).toBe(100)
  })

  it('gives 50% at exactly seven days, which is the boundary', () => {
    expect(previewRefundPercentage('2026-08-08', now)).toBe(50)
  })

  it('gives 50% from four to seven days', () => {
    expect(previewRefundPercentage('2026-08-05', now)).toBe(50)
  })

  it('gives 0% from three days out — earlier than the old copy implied', () => {
    expect(previewRefundPercentage('2026-08-04', now)).toBe(0)
    expect(previewRefundPercentage('2026-08-02', now)).toBe(0)
  })

  it('gives 0% on the day of departure and after it', () => {
    expect(previewRefundPercentage('2026-08-01', now)).toBe(0)
    expect(previewRefundPercentage('2026-07-20', now)).toBe(0)
  })

  it('is timezone-stable, comparing whole UTC days', () => {
    // Late in the day must not shift the tier.
    const lateEvening = new Date('2026-08-01T23:59:00Z')
    expect(previewRefundPercentage('2026-08-09', lateEvening)).toBe(100)
  })

  it('returns 0 rather than throwing on an unparseable date', () => {
    expect(previewRefundPercentage('not-a-date', now)).toBe(0)
  })
})
