import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ApiError } from '@/lib/api-client'
import type { ApiQueryResult } from '@/lib/use-api-query'
import type { TripSummary } from '@/types/catalog'

// Task 10.4 — Trip detail "Book Now" CTA + recommended trips.
//
// Validates: Requirement 36.8 (a "Book Now" button that navigates to the
// booking flow, in the selected display currency) and Requirement 36.9
// (similar / recommended trips at the bottom of the page, with graceful
// loading / error / empty handling and self-exclusion).
//
// RelatedTrips fetches through useApiQuery, so we mock it (same pattern as
// reviews / festival-detail / explore-landing).
const useApiQuery = vi.fn()
vi.mock('@/lib/use-api-query', () => ({
  useApiQuery: (...args: unknown[]) => useApiQuery(...args),
}))

import { BookNowCTA } from '@/components/trips/BookNowCTA'
import { RelatedTrips } from '@/components/trips/RelatedTrips'

function makeTrip(over: Partial<TripSummary> = {}): TripSummary {
  return {
    id: 't1',
    slug: 'angkor-sunrise',
    name: 'Angkor Sunrise',
    coverImageUrl: null,
    durationDays: 2,
    priceUsd: 120,
    category: 'Temples',
    location: 'Siem Reap',
    ratingAverage: 4.8,
    ratingCount: 23,
    ...over,
  }
}

function result<T>(over: Partial<ApiQueryResult<T>>): ApiQueryResult<T> {
  return { data: null, error: null, isLoading: false, refetch: vi.fn(), ...over }
}

describe('BookNowCTA (Req 36.8)', () => {
  it('renders the price and a Book Now link to the booking flow', () => {
    render(<BookNowCTA href="/trips/angkor-sunrise/book" priceUsd={120} />)
    const link = screen.getByRole('link', { name: 'Book Now' })
    expect(link).toHaveAttribute('href', '/trips/angkor-sunrise/book')
    // Price shown in the default display currency (USD for the en locale).
    expect(screen.getByText(/\$120/)).toBeInTheDocument()
  })

  it('renders a disabled button with no booking link when the trip is unavailable', () => {
    render(<BookNowCTA href="/trips/angkor-sunrise/book" priceUsd={120} disabled />)
    expect(screen.queryByRole('link', { name: 'Book Now' })).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Unavailable' })
    expect(button).toBeDisabled()
  })
})

describe('RelatedTrips (Req 36.9)', () => {
  beforeEach(() => useApiQuery.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('shows skeleton placeholders while loading', () => {
    useApiQuery.mockReturnValue(result<TripSummary[]>({ isLoading: true }))
    const { container } = render(<RelatedTrips tripId="t1" />)
    expect(screen.getByText('You might also like')).toBeInTheDocument()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('renders nothing on error (recommendations are supplementary)', () => {
    useApiQuery.mockReturnValue(
      result<TripSummary[]>({
        error: new ApiError({ code: 'X', message: 'boom', status: 500 }),
      }),
    )
    const { container } = render(<RelatedTrips tripId="t1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when there are no related trips', () => {
    useApiQuery.mockReturnValue(result<TripSummary[]>({ data: [] }))
    const { container } = render(<RelatedTrips tripId="t1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a card per related trip', () => {
    useApiQuery.mockReturnValue(
      result<TripSummary[]>({
        data: [
          makeTrip({ id: 'a', name: 'Bayon Day Trip' }),
          makeTrip({ id: 'b', name: 'Tonle Sap' }),
        ],
      }),
    )
    render(<RelatedTrips tripId="t1" />)
    expect(screen.getByText('Bayon Day Trip')).toBeInTheDocument()
    expect(screen.getByText('Tonle Sap')).toBeInTheDocument()
  })

  it('excludes the current trip from the recommendations', () => {
    useApiQuery.mockReturnValue(
      result<TripSummary[]>({
        data: [makeTrip({ id: 't1', name: 'Self Trip' }), makeTrip({ id: 'b', name: 'Tonle Sap' })],
      }),
    )
    render(<RelatedTrips tripId="t1" />)
    expect(screen.queryByText('Self Trip')).not.toBeInTheDocument()
    expect(screen.getByText('Tonle Sap')).toBeInTheDocument()
  })

  it('hides the section when the only related trip is the current one', () => {
    useApiQuery.mockReturnValue(
      result<TripSummary[]>({ data: [makeTrip({ id: 't1', name: 'Self Trip' })] }),
    )
    const { container } = render(<RelatedTrips tripId="t1" />)
    expect(container).toBeEmptyDOMElement()
  })
})
