import { describe, it, expect } from 'vitest'
import { bookingHasReceipt, deriveReceipt, paymentStatusForBooking } from '@/lib/receipt'
import type { BookingDetail } from '@/types/api'

// Task 12.5 — payment receipt functionality (Requirement 6.9: store the payment
// receipt and allow users to download it). The backend has no receipt endpoint,
// so the receipt is *derived* from the confirmed booking detail. These tests pin
// that derivation so the receipt always reflects real, server-owned data.

function booking(overrides: Partial<BookingDetail> = {}): BookingDetail {
  return {
    id: 'b1',
    reference: 'DLG-12345',
    type: 'trip',
    name: 'Angkor Sunrise',
    startDate: '2026-07-01',
    endDate: '2026-07-03',
    status: 'CONFIRMED',
    totalPriceUsd: 240,
    coverImageUrl: null,
    ...overrides,
  }
}

describe('paymentStatusForBooking', () => {
  it('maps CONFIRMED / COMPLETED to succeeded', () => {
    expect(paymentStatusForBooking(booking({ status: 'CONFIRMED' }))).toBe('succeeded')
    expect(paymentStatusForBooking(booking({ status: 'COMPLETED' }))).toBe('succeeded')
  })

  it('maps a cancelled booking with a refund to refunded', () => {
    expect(paymentStatusForBooking(booking({ status: 'CANCELLED', refundAmountUsd: 120 }))).toBe(
      'refunded',
    )
  })

  it('maps a cancelled booking with no refund to failed', () => {
    expect(paymentStatusForBooking(booking({ status: 'CANCELLED' }))).toBe('failed')
    expect(paymentStatusForBooking(booking({ status: 'CANCELLED', refundAmountUsd: 0 }))).toBe(
      'failed',
    )
  })

  it('maps pre-payment states to pending', () => {
    expect(paymentStatusForBooking(booking({ status: 'HOLD' }))).toBe('pending')
    expect(paymentStatusForBooking(booking({ status: 'PENDING_PAYMENT' }))).toBe('pending')
  })
})

describe('bookingHasReceipt', () => {
  it('is true once paid (confirmed) or refunded', () => {
    expect(bookingHasReceipt(booking({ status: 'CONFIRMED' }))).toBe(true)
    expect(bookingHasReceipt(booking({ status: 'CANCELLED', refundAmountUsd: 50 }))).toBe(true)
  })

  it('is false before payment and for null', () => {
    expect(bookingHasReceipt(booking({ status: 'HOLD' }))).toBe(false)
    expect(bookingHasReceipt(booking({ status: 'PENDING_PAYMENT' }))).toBe(false)
    expect(bookingHasReceipt(null)).toBe(false)
    expect(bookingHasReceipt(undefined)).toBe(false)
  })
})

describe('deriveReceipt', () => {
  it('uses the real booking reference and total (no invented payment data)', () => {
    const r = deriveReceipt(booking())
    expect(r.bookingReference).toBe('DLG-12345')
    expect(r.amountUsd).toBe(240)
    expect(r.status).toBe('succeeded')
  })

  it('maps booking items to receipt line items, formatting quantity', () => {
    const r = deriveReceipt(
      booking({
        items: [
          { name: 'Adult ticket', quantity: 2, totalPriceUsd: 200 },
          { name: 'Guide', quantity: 1, totalPriceUsd: 40 },
        ],
      }),
    )
    expect(r.lineItems).toEqual([
      { label: 'Adult ticket × 2', amountUsd: 200 },
      { label: 'Guide', amountUsd: 40 },
    ])
  })

  it('derives a line item amount from unit price × quantity when total is absent', () => {
    const r = deriveReceipt(
      booking({ items: [{ name: 'Adult ticket', quantity: 3, unitPriceUsd: 50 }] }),
    )
    expect(r.lineItems[0]).toEqual({ label: 'Adult ticket × 3', amountUsd: 150 })
  })

  it('synthesises a single total line when the booking has no items', () => {
    const r = deriveReceipt(booking({ items: [] }))
    expect(r.lineItems).toEqual([{ label: 'Angkor Sunrise', amountUsd: 240 }])
  })

  it('defaults provider to stripe and honours an explicit override', () => {
    expect(deriveReceipt(booking()).provider).toBe('stripe')
    expect(deriveReceipt(booking(), { provider: 'bakong' }).provider).toBe('bakong')
  })

  it('records the requested display currency as metadata, leaving amounts in USD', () => {
    const r = deriveReceipt(booking(), { currency: 'KHR' })
    expect(r.currency).toBe('KHR')
    expect(r.amountUsd).toBe(240)
  })
})
