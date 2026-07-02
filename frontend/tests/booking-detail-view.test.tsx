import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useLanguageStore } from '@/lib/i18n'
import { usePreferencesStore } from '@/stores/preferences.store'
import { SUPPORT_EMAIL } from '@/lib/support'
import type { ApiQueryResult } from '@/lib/use-api-query'
import type { BookingDetail } from '@/types/api'

// Task 14.4 — Booking detail page.
//
// Beyond the core booking info, QR and items already rendered, the detail page
// must surface the trip's meeting point/location (Requirement 36.4) and the
// support/contact information with instructions for changes (Requirement 39.7 —
// "Display contact information"). This verifies those two additions render and
// that the location block is omitted when the backend has no location.

const useApiQuery = vi.fn()
vi.mock('@/lib/use-api-query', () => ({
  useApiQuery: (...args: unknown[]) => useApiQuery(...args),
}))

// BookingShell gates on auth; treat the user as authenticated and rehydrated.
vi.mock('@/hooks/use-auth', () => ({
  useRequireAuth: () => ({ isAuthenticated: true, rehydrated: true }),
}))

import { BookingDetailView } from '@/components/bookings/BookingDetailView'

function detail(over: Partial<BookingDetail> = {}): BookingDetail {
  return {
    id: 'bk-1',
    reference: 'TRP-ABC123',
    type: 'trip',
    name: 'Angkor Wat Sunrise Tour',
    location: 'Siem Reap — Angkor Ticket Office',
    startDate: '2026-12-01',
    endDate: '2026-12-03',
    status: 'CONFIRMED',
    totalPriceUsd: 120,
    coverImageUrl: null,
    items: [{ id: 'it-1', name: 'Adult', quantity: 2, totalPriceUsd: 120 }],
    specialRequests: null,
    ...over,
  }
}

/**
 * Wire the two queries the view issues: the booking detail (`/v1/bookings/:id`)
 * and, when confirmed, the QR (`/v1/bookings/:id/qr`). Keyed by URL so order is
 * irrelevant.
 */
function mockQueries(booking: BookingDetail | null, opts: { qr?: string } = {}) {
  useApiQuery.mockImplementation((path: string | null): ApiQueryResult<unknown> => {
    if (path && path.endsWith('/qr')) {
      return {
        data: opts.qr ? { qrCodeUrl: opts.qr } : null,
        error: null,
        isLoading: false,
        refetch: vi.fn(),
      }
    }
    return { data: booking, error: null, isLoading: false, refetch: vi.fn() }
  })
}

describe('BookingDetailView — contact info & meeting point (Task 14.4)', () => {
  beforeEach(() => {
    useApiQuery.mockReset()
    useLanguageStore.setState({ locale: 'en' })
    usePreferencesStore.setState({ currency: 'USD' })
  })
  afterEach(() => vi.clearAllMocks())

  it('renders the meeting point/location when present (Req 36.4)', () => {
    mockQueries(detail())
    render(<BookingDetailView id="bk-1" />)
    expect(screen.getByText('Meeting point')).toBeInTheDocument()
    expect(screen.getByText(/Angkor Ticket Office/)).toBeInTheDocument()
  })

  it('omits the location block when the booking has no location', () => {
    mockQueries(detail({ location: null }))
    render(<BookingDetailView id="bk-1" />)
    expect(screen.queryByText('Meeting point')).not.toBeInTheDocument()
  })

  it('renders the support/contact information (Req 39.7)', () => {
    mockQueries(detail())
    render(<BookingDetailView id="bk-1" />)
    expect(screen.getByTestId('support-info')).toBeInTheDocument()
    expect(screen.getByText('Contact & support')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: SUPPORT_EMAIL })).toHaveAttribute(
      'href',
      `mailto:${SUPPORT_EMAIL}`,
    )
    expect(screen.getByText(/change or cancel this booking/i)).toBeInTheDocument()
  })

  it('still shows the core booking info and check-in QR when confirmed (Req 7.9/39.2)', () => {
    mockQueries(detail(), { qr: 'https://cdn.example/qr/bk-1.png' })
    render(<BookingDetailView id="bk-1" />)
    expect(screen.getByText('Angkor Wat Sunrise Tour')).toBeInTheDocument()
    expect(screen.getByText('TRP-ABC123')).toBeInTheDocument()
    expect(screen.getByAltText('Check-in QR')).toHaveAttribute(
      'src',
      'https://cdn.example/qr/bk-1.png',
    )
  })
})
