import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PaymentReceipt } from '@/components/checkout/PaymentReceipt'
import { deriveReceipt } from '@/lib/receipt'
import type { BookingDetail } from '@/types/api'

// Task 12.5 — payment receipt functionality (Requirement 6.9).
//
// The receipt must show the reference, amount paid, method, date, and itemized
// line items, and let the user download it. Download is the browser's native
// print-to-PDF, so we assert window.print() is invoked. We render the receipt
// component directly (rather than through the auth-gated ConfirmationView shell,
// mirroring tests/booking-not-found.test.tsx).

const confirmedBooking: BookingDetail = {
  id: 'b1',
  reference: 'DLG-98765',
  type: 'trip',
  name: 'Angkor Sunrise',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  status: 'CONFIRMED',
  totalPriceUsd: 240,
  coverImageUrl: null,
  items: [
    { name: 'Adult ticket', quantity: 2, totalPriceUsd: 200 },
    { name: 'Guide', quantity: 1, totalPriceUsd: 40 },
  ],
}

describe('PaymentReceipt (Task 12.5)', () => {
  afterEach(() => vi.clearAllMocks())

  it('renders the receipt summary derived from the confirmed booking', () => {
    render(<PaymentReceipt receipt={deriveReceipt(confirmedBooking)} />)

    expect(screen.getByTestId('payment-receipt')).toBeInTheDocument()
    expect(screen.getByText('Payment receipt')).toBeInTheDocument()
    expect(screen.getByText('DLG-98765')).toBeInTheDocument()
    expect(screen.getByText('Adult ticket × 2')).toBeInTheDocument()
    expect(screen.getByText('Guide')).toBeInTheDocument()
    // USD total (en/USD default) is shown.
    expect(screen.getByText('$240.00')).toBeInTheDocument()
    // Status + method labels.
    expect(screen.getByText('Paid')).toBeInTheDocument()
    expect(screen.getByText('Card')).toBeInTheDocument()
  })

  it('downloads the receipt via the browser print-to-PDF', () => {
    const printSpy = vi.fn()
    Object.defineProperty(window, 'print', {
      writable: true,
      configurable: true,
      value: printSpy,
    })

    render(<PaymentReceipt receipt={deriveReceipt(confirmedBooking)} />)
    fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    expect(printSpy).toHaveBeenCalledTimes(1)
  })

  it('falls back to a single total line when the booking has no items', () => {
    render(<PaymentReceipt receipt={deriveReceipt({ ...confirmedBooking, items: [] })} />)
    expect(screen.getByText('Angkor Sunrise')).toBeInTheDocument()
    // The amount appears as both the single line item and the total.
    expect(screen.getAllByText('$240.00')).toHaveLength(2)
  })
})
