'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import * as React from 'react'

import { useAccessToken } from '@/hooks/use-auth'
import { bookingsApi, newIdempotencyKey, type BookingFilters } from '@/lib/api/bookings'
import { ApiError } from '@/lib/api/errors'
import type { Locale } from '@/lib/i18n/config'
import type {
  Booking,
  CreateGuideBookingBody,
  CreateHotelBookingBody,
  CreateTransportBookingBody,
  CreateTripBookingBody,
  PaymentMethod,
} from '@/schemas/booking'

/**
 * Booking data hooks.
 *
 * Booking keys do NOT start with the locale, unlike the catalogue: a booking is the
 * user's own record and its identity does not change with language. They are scoped
 * by token instead, so signing out cannot leave another user's bookings in cache.
 */

function bookingKeys(token: string | null) {
  const owner = token ? 'me' : 'anon'
  return {
    all: ['bookings', owner] as const,
    list: (filters: BookingFilters) => ['bookings', owner, 'list', filters] as const,
    detail: (id: string) => ['bookings', owner, 'detail', id] as const,
  }
}

export function useBookings(filters: BookingFilters = {}) {
  const token = useAccessToken()
  const locale = useLocale() as Locale
  const keys = bookingKeys(token)

  return useQuery({
    queryKey: keys.list(filters),
    // Without a token the request would 401, so it is not worth sending.
    enabled: Boolean(token),
    queryFn: () => bookingsApi.list(token!, locale, filters),
  })
}

export function useBooking(id: string | undefined) {
  const token = useAccessToken()
  const locale = useLocale() as Locale
  const keys = bookingKeys(token)

  return useQuery({
    queryKey: keys.detail(id ?? ''),
    enabled: Boolean(token) && Boolean(id),
    queryFn: () => bookingsApi.detail(token!, locale, id!),
    /*
     * A hold expires server-side after 15 minutes, so a stale copy would show a
     * confirm button for a booking that is already gone.
     */
    staleTime: 15_000,
  })
}

/**
 * Creates a booking hold.
 *
 * The idempotency key is minted ONCE per mount and reused for every retry of the
 * same attempt, which is the whole point: a network timeout followed by a retry
 * must not produce two holds. A successful booking mints a fresh key so the next
 * distinct booking is not deduplicated against the last one.
 */
export function useCreateBooking() {
  const token = useAccessToken()
  const locale = useLocale() as Locale
  const queryClient = useQueryClient()
  const keyRef = React.useRef(newIdempotencyKey())

  return useMutation({
    mutationFn: async (input: CreateBookingInput): Promise<Booking> => {
      if (!token) throw new Error('not authenticated')
      const idempotencyKey = keyRef.current

      switch (input.type) {
        case 'trip':
          return bookingsApi.createTripBooking(token, locale, input.id, input.body, idempotencyKey)
        case 'hotel':
          return bookingsApi.createHotelBooking(token, locale, input.id, input.body, idempotencyKey)
        case 'guide':
          return bookingsApi.createGuideBooking(token, locale, input.id, input.body, idempotencyKey)
        case 'transport':
          return bookingsApi.createTransportBooking(token, locale, input.body, idempotencyKey)
      }
    },
    onSuccess: (booking) => {
      // The next booking is a different intent and must not be deduplicated.
      keyRef.current = newIdempotencyKey()
      queryClient.invalidateQueries({ queryKey: bookingKeys(token).all })
      queryClient.setQueryData(bookingKeys(token).detail(booking.id), booking)
    },
  })
}

export type CreateBookingInput =
  | { type: 'trip'; id: string; body: CreateTripBookingBody }
  | { type: 'hotel'; id: string; body: CreateHotelBookingBody }
  | { type: 'guide'; id: string; body: CreateGuideBookingBody }
  | { type: 'transport'; body: CreateTransportBookingBody }

/** Sandbox payment confirmation. */
export function useConfirmBooking() {
  const token = useAccessToken()
  const locale = useLocale() as Locale
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, method }: { id: string; method: PaymentMethod }) => {
      if (!token) throw new Error('not authenticated')
      return bookingsApi.confirm(token, locale, id, method)
    },
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingKeys(token).detail(booking.id), booking)
      queryClient.invalidateQueries({ queryKey: bookingKeys(token).all })
    },
  })
}

export function useCancelBooking() {
  const token = useAccessToken()
  const locale = useLocale() as Locale
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => {
      if (!token) throw new Error('not authenticated')
      return bookingsApi.cancel(token, locale, id, reason)
    },
    onSuccess: (_refund, { id }) => {
      /*
       * Cancelling returns only the refund, never the updated booking, so the
       * record MUST be refetched — trusting the old copy would keep showing the
       * booking as active.
       */
      queryClient.invalidateQueries({ queryKey: bookingKeys(token).detail(id) })
      queryClient.invalidateQueries({ queryKey: bookingKeys(token).all })
    },
  })
}

/**
 * True when confirmation failed because the server has demo payments switched off.
 *
 * Worth distinguishing: it is a deployment state, not something the user did wrong,
 * so it deserves its own message rather than a generic failure.
 */
export function isDemoPaymentsDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.isForbidden
}
