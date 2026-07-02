import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { computeTripPrice } from '@/lib/booking-pricing'
import { BookingPriceBreakdown } from '@/components/booking/BookingPriceBreakdown'
import { useLanguageStore } from '@/lib/i18n'
import { usePreferencesStore } from '@/stores/preferences.store'

// Task 11.3 — trip booking price summary with breakdown.
//
// Validates: Requirements 5.4 (display a booking summary with total price,
// breakdown of costs, and applicable discounts). The computation mirrors the
// backend booking engine: children are charged at the full per-person price,
// so totalUsd = pricePerPersonUsd × (adults + children) − discount.

describe('computeTripPrice (Req 5.4)', () => {
  it('totals adults + children at the full per-person price', () => {
    const b = computeTripPrice({ pricePerPersonUsd: 50, adults: 2, children: 1 })
    expect(b.totalTravelers).toBe(3)
    expect(b.subtotalUsd).toBe(150)
    expect(b.totalUsd).toBe(150)
  })

  it('produces a line per traveler category with quantity and unit price', () => {
    const b = computeTripPrice({ pricePerPersonUsd: 40, adults: 2, children: 3 })
    const adults = b.lines.find((l) => l.key === 'adults')
    const children = b.lines.find((l) => l.key === 'children')
    expect(adults).toMatchObject({ quantity: 2, unitUsd: 40, amountUsd: 80 })
    expect(children).toMatchObject({ quantity: 3, unitUsd: 40, amountUsd: 120 })
  })

  it('omits the children line when there are no children', () => {
    const b = computeTripPrice({ pricePerPersonUsd: 40, adults: 1, children: 0 })
    expect(b.lines.find((l) => l.key === 'children')).toBeUndefined()
  })

  it('applies a discount as a negative line and never below zero', () => {
    const b = computeTripPrice({ pricePerPersonUsd: 100, adults: 1, children: 0, discountUsd: 25 })
    expect(b.discountUsd).toBe(25)
    expect(b.totalUsd).toBe(75)
    expect(b.lines.find((l) => l.key === 'discount')?.amountUsd).toBe(-25)
  })

  it('clamps a discount that exceeds the subtotal', () => {
    const b = computeTripPrice({ pricePerPersonUsd: 100, adults: 1, children: 0, discountUsd: 500 })
    expect(b.discountUsd).toBe(100)
    expect(b.totalUsd).toBe(0)
  })

  it('treats invalid/zero counts as zero rather than throwing', () => {
    const b = computeTripPrice({ pricePerPersonUsd: 50, adults: NaN, children: -2 })
    expect(b.totalTravelers).toBe(0)
    expect(b.totalUsd).toBe(0)
    expect(b.lines).toHaveLength(0)
  })

  // Property-style check: total must always equal subtotal minus discount, and
  // the subtotal must equal per-person × total travelers, across many inputs.
  it('keeps total = per-person × travelers − discount across many inputs', () => {
    for (let i = 0; i < 200; i++) {
      const price = Math.round(Math.random() * 500)
      const adults = Math.floor(Math.random() * 10)
      const children = Math.floor(Math.random() * 10)
      const discount = Math.round(Math.random() * 1000)
      const b = computeTripPrice({
        pricePerPersonUsd: price,
        adults,
        children,
        discountUsd: discount,
      })
      const expectedSubtotal = price * (adults + children)
      expect(b.subtotalUsd).toBe(expectedSubtotal)
      expect(b.totalUsd).toBe(expectedSubtotal - b.discountUsd)
      expect(b.totalUsd).toBeGreaterThanOrEqual(0)
      expect(b.discountUsd).toBeLessThanOrEqual(expectedSubtotal)
    }
  })
})

describe('BookingPriceBreakdown (Req 5.4)', () => {
  beforeEach(() => {
    useLanguageStore.setState({ locale: 'en' })
    // Default display currency to USD for deterministic formatting.
    usePreferencesStore.setState({ currency: 'USD' })
  })

  it('renders the live total for the selected travelers in USD', () => {
    render(<BookingPriceBreakdown pricePerPersonUsd={50} adults={2} childrenCount={1} />)
    // 3 travelers × $50 = $150 total.
    expect(screen.getByText('$150.00')).toBeInTheDocument()
    expect(screen.getByText('3 travelers')).toBeInTheDocument()
  })

  it('shows the children-pricing note only when children are present', () => {
    const { rerender } = render(
      <BookingPriceBreakdown pricePerPersonUsd={50} adults={1} childrenCount={0} />,
    )
    expect(
      screen.queryByText('Children are charged at the full per-person price.'),
    ).not.toBeInTheDocument()
    rerender(<BookingPriceBreakdown pricePerPersonUsd={50} adults={1} childrenCount={2} />)
    expect(
      screen.getByText('Children are charged at the full per-person price.'),
    ).toBeInTheDocument()
  })

  it('renders amounts in the selected display currency', () => {
    usePreferencesStore.setState({ currency: 'KHR' })
    render(<BookingPriceBreakdown pricePerPersonUsd={10} adults={1} childrenCount={0} />)
    // 10 USD × 4100 = 41,000 KHR (converted, not the USD figure).
    expect(screen.getAllByText(/41,000/).length).toBeGreaterThan(0)
    expect(screen.queryByText('$10.00')).not.toBeInTheDocument()
  })
})
