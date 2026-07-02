'use client'

import { useMemo } from 'react'
import { useApiQuery, type ApiQueryResult } from '@/lib/use-api-query'
import { bookingGroup, type BookingGroup } from '@/lib/bookings-display'
import type { Paginated, UnifiedBooking } from '@/types/api'

/** Default page size for the My Trips list (Requirement 7.2, 7.3). */
export const BOOKINGS_PAGE_SIZE = 50

/** Bookings grouped into the My Trips tabs (Requirement 7.2, 7.3). */
export type GroupedBookings = Record<BookingGroup, UnifiedBooking[]>

export interface UseBookingsResult extends ApiQueryResult<Paginated<UnifiedBooking>> {
  /**
   * The fetched bookings bucketed by tab via {@link bookingGroup}:
   * - `upcoming` — CONFIRMED / PENDING_PAYMENT / HOLD (Requirement 7.2)
   * - `past` — COMPLETED / EXPIRED (Requirement 7.3)
   * - `cancelled` — CANCELLED (Requirement 7.3)
   */
  grouped: GroupedBookings
}

/**
 * Fetch the current user's bookings from `GET /v1/bookings` and group them into
 * the My Trips tabs.
 *
 * Wraps the lightweight {@link useApiQuery} layer (the project's deliberate
 * alternative to React Query) and centralizes status → tab bucketing so the
 * filtering rule (Requirement 7.2/7.3) lives in one place and can be reused.
 */
export function useBookings(limit: number = BOOKINGS_PAGE_SIZE): UseBookingsResult {
  const query = useApiQuery<Paginated<UnifiedBooking>>(`/v1/bookings?limit=${limit}`)

  const grouped = useMemo<GroupedBookings>(() => {
    const buckets: GroupedBookings = { upcoming: [], past: [], cancelled: [] }
    for (const booking of query.data?.items ?? []) {
      buckets[bookingGroup(booking.status)].push(booking)
    }
    return buckets
  }, [query.data])

  return { ...query, grouped }
}
