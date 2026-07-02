import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BookingCard } from '@/components/bookings/BookingCard'
import { useLanguageStore } from '@/lib/i18n'
import { usePreferencesStore } from '@/stores/preferences.store'
import type { UnifiedBooking } from '@/types/api'

// BookingCard displays each booking's name, location, dates, status and price,
// and links to the booking detail page (Requirements 7.4, 7.5).

function booking(over: Partial<UnifiedBooking> = {}): UnifiedBooking {
  return {
    id: 'bk-1',
    reference: 'TRP-ABC123',
    type: 'trip',
    name: 'Angkor Wat Sunrise Tour',
    location: 'Siem Reap',
    startDate: '2026-12-01',
    endDate: '2026-12-03',
    status: 'CONFIRMED',
    totalPriceUsd: 120,
    coverImageUrl: null,
    ...over,
  }
}

describe('BookingCard (Req 7.4, 7.5)', () => {
  beforeEach(() => {
    useLanguageStore.setState({ locale: 'en' })
    usePreferencesStore.setState({ currency: 'USD' })
  })

  it('renders name, location, date range, status and price', () => {
    render(<BookingCard booking={booking()} />)
    expect(screen.getByText('Angkor Wat Sunrise Tour')).toBeInTheDocument()
    expect(screen.getByText('Siem Reap')).toBeInTheDocument()
    expect(screen.getByText(/Dec 1, 2026.*Dec 3, 2026/)).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByText(/\$120/)).toBeInTheDocument()
  })

  it('links to the booking detail page', () => {
    render(<BookingCard booking={booking({ id: 'bk-42' })} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/bookings/bk-42')
  })

  it('collapses an identical start/end date into a single value', () => {
    render(<BookingCard booking={booking({ startDate: '2026-12-01', endDate: '2026-12-01' })} />)
    expect(screen.getByText('Dec 1, 2026')).toBeInTheDocument()
  })

  it('omits the location row when no location is available', () => {
    render(<BookingCard booking={booking({ location: null, name: 'No-Location Trip' })} />)
    expect(screen.getByText('No-Location Trip')).toBeInTheDocument()
    expect(screen.queryByText('Siem Reap')).not.toBeInTheDocument()
  })

  it('reflects a pending status with its localized label', () => {
    render(<BookingCard booking={booking({ status: 'PENDING_PAYMENT' })} />)
    expect(screen.getByText('Pending payment')).toBeInTheDocument()
  })
})
