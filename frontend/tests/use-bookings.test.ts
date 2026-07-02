import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ApiQueryResult } from '@/lib/use-api-query'
import type { Paginated, UnifiedBooking } from '@/types/api'

// useBookings wraps the lightweight query layer and buckets bookings into the
// My Trips tabs. Drive it by mocking useApiQuery, matching the suite pattern.
const useApiQuery = vi.fn()
vi.mock('@/lib/use-api-query', () => ({
  useApiQuery: (...args: unknown[]) => useApiQuery(...args),
}))

import { useBookings, BOOKINGS_PAGE_SIZE } from '@/hooks/use-bookings'

function booking(id: string, status: string): UnifiedBooking {
  return {
    id,
    reference: id,
    type: 'trip',
    name: id,
    location: null,
    startDate: '2026-12-01',
    endDate: '2026-12-03',
    status,
    totalPriceUsd: 100,
    coverImageUrl: null,
  }
}

function result(
  over: Partial<ApiQueryResult<Paginated<UnifiedBooking>>>,
): ApiQueryResult<Paginated<UnifiedBooking>> {
  return { data: null, error: null, isLoading: false, refetch: vi.fn(), ...over }
}

describe('useBookings (Req 7.2, 7.3)', () => {
  beforeEach(() => useApiQuery.mockReset())

  it('requests the bookings list with the default page size', () => {
    useApiQuery.mockReturnValue(result({ isLoading: true }))
    renderHook(() => useBookings())
    expect(useApiQuery.mock.calls[0][0]).toBe(`/v1/bookings?limit=${BOOKINGS_PAGE_SIZE}`)
  })

  it('buckets confirmed and pending bookings into upcoming (Req 7.2)', () => {
    useApiQuery.mockReturnValue(
      result({
        data: {
          items: [booking('a', 'CONFIRMED'), booking('b', 'PENDING_PAYMENT'), booking('c', 'HOLD')],
          page: 1,
          limit: 50,
          total: 3,
          totalPages: 1,
        } as Paginated<UnifiedBooking>,
      }),
    )
    const { result: hook } = renderHook(() => useBookings())
    expect(hook.current.grouped.upcoming.map((b) => b.id)).toEqual(['a', 'b', 'c'])
    expect(hook.current.grouped.past).toHaveLength(0)
    expect(hook.current.grouped.cancelled).toHaveLength(0)
  })

  it('buckets completed/expired into past and cancelled into its own tab (Req 7.3)', () => {
    useApiQuery.mockReturnValue(
      result({
        data: {
          items: [booking('a', 'COMPLETED'), booking('b', 'EXPIRED'), booking('c', 'CANCELLED')],
          page: 1,
          limit: 50,
          total: 3,
          totalPages: 1,
        } as Paginated<UnifiedBooking>,
      }),
    )
    const { result: hook } = renderHook(() => useBookings())
    expect(hook.current.grouped.past.map((b) => b.id)).toEqual(['a', 'b'])
    expect(hook.current.grouped.cancelled.map((b) => b.id)).toEqual(['c'])
    expect(hook.current.grouped.upcoming).toHaveLength(0)
  })

  it('returns empty buckets while loading', () => {
    useApiQuery.mockReturnValue(result({ isLoading: true }))
    const { result: hook } = renderHook(() => useBookings())
    expect(hook.current.grouped).toEqual({ upcoming: [], past: [], cancelled: [] })
  })

  it('forwards a custom page size', () => {
    useApiQuery.mockReturnValue(result({ isLoading: true }))
    renderHook(() => useBookings(10))
    expect(useApiQuery.mock.calls[0][0]).toBe('/v1/bookings?limit=10')
  })
})
