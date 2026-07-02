import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ApiError } from '@/lib/api-client'
import type { ApiQueryResult } from '@/lib/use-api-query'

// Task 11.4 — Booking pages must handle the invalid / unknown id case.
//
// When the resource being booked can't be loaded (e.g. a stale or invalid id
// returns 404), the booking forms must not present a form for something that
// doesn't exist. Instead they render a clear "not found" state with a way back.
//
// Validates: Requirement 5.1/5.7 (a booking form is shown for a *selected*
// resource) — an unknown id is not a selectable resource, so we degrade
// gracefully rather than rendering an unusable form.

const useApiQuery = vi.fn()
vi.mock('@/lib/use-api-query', () => ({
  useApiQuery: (...args: unknown[]) => useApiQuery(...args),
}))

const back = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

import { TripBookingForm } from '@/components/booking/TripBookingForm'
import { GuideBookingForm } from '@/components/booking/GuideBookingForm'
import { TransportBookingForm } from '@/components/booking/TransportBookingForm'
import { HotelBookingForm } from '@/components/booking/HotelBookingForm'

function ok<T>(data: T): ApiQueryResult<T> {
  return { data, error: null, isLoading: false, refetch: vi.fn() }
}
function notFound<T>(): ApiQueryResult<T> {
  return {
    data: null,
    error: new ApiError({ code: 'NOT_FOUND', message: 'not found', status: 404 }),
    isLoading: false,
    refetch: vi.fn(),
  }
}

describe('Booking forms — invalid/unknown id handling (Task 11.4)', () => {
  beforeEach(() => useApiQuery.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('TripBookingForm shows a not-found state instead of the form on 404', () => {
    useApiQuery.mockReturnValue(notFound())
    render(<TripBookingForm tripId="missing" />)
    expect(screen.getByText("We couldn't find that")).toBeInTheDocument()
    expect(screen.queryByText('Complete your booking')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go back' })).toHaveAttribute('href', '/trips')
  })

  it('GuideBookingForm shows a not-found state on 404', () => {
    useApiQuery.mockReturnValue(notFound())
    render(<GuideBookingForm guideId="missing" />)
    expect(screen.getByText("We couldn't find that")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go back' })).toHaveAttribute('href', '/guides')
  })

  it('TransportBookingForm shows a not-found state on 404', () => {
    useApiQuery.mockReturnValue(notFound())
    render(<TransportBookingForm vehicleId="missing" />)
    expect(screen.getByText("We couldn't find that")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go back' })).toHaveAttribute('href', '/transportation')
  })

  it('HotelBookingForm shows a not-found state on 404 (before the room check)', () => {
    useApiQuery.mockReturnValue(notFound())
    render(<HotelBookingForm hotelId="missing" roomId={null} />)
    expect(screen.getByText("We couldn't find that")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go back' })).toHaveAttribute('href', '/hotels')
  })

  it('TripBookingForm renders the form normally when the trip loads', () => {
    useApiQuery.mockReturnValue(
      ok({
        id: 't1',
        name: 'Angkor Sunrise',
        coverImageUrl: null,
        location: 'Siem Reap',
        priceUsd: 120,
        maxGuests: 10,
      }),
    )
    render(<TripBookingForm tripId="t1" />)
    expect(screen.getByText('Complete your booking')).toBeInTheDocument()
    expect(screen.queryByText("We couldn't find that")).not.toBeInTheDocument()
  })
})
