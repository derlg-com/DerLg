'use client'

import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { useLocale } from 'next-intl'

import { queryKeys } from '@/lib/api/query-keys'
import {
  guidesApi,
  hotelsApi,
  placesApi,
  searchApi,
  transportApi,
  tripsApi,
  type GuideFilters,
  type HotelFilters,
  type PlaceFilters,
  type TripFilters,
  type VehicleFilters,
} from '@/lib/api/resources'
import type { Locale } from '@/lib/i18n/config'

/**
 * React Query hooks for the public catalogue.
 *
 * Each hook reads the active locale itself, so callers cannot accidentally fetch
 * English content into a Khmer page, and the locale is part of the cache key.
 */

type Options<T> = Omit<UseQueryOptions<T, Error, T>, 'queryKey' | 'queryFn'>

export function useTrips(filters: TripFilters = {}, options?: Options<Awaited<ReturnType<typeof tripsApi.list>>>) {
  const locale = useLocale() as Locale
  return useQuery({
    queryKey: queryKeys.trips.list(locale, filters),
    queryFn: ({ signal }) => tripsApi.list(filters, { locale, signal }),
    ...options,
  })
}

export function useTrip(id: string, options?: Options<Awaited<ReturnType<typeof tripsApi.detail>>>) {
  const locale = useLocale() as Locale
  return useQuery({
    queryKey: queryKeys.trips.detail(locale, id),
    queryFn: ({ signal }) => tripsApi.detail(id, { locale, signal }),
    enabled: Boolean(id),
    ...options,
  })
}

export function useRelatedTrips(id: string) {
  const locale = useLocale() as Locale
  return useQuery({
    queryKey: queryKeys.trips.related(locale, id),
    queryFn: ({ signal }) => tripsApi.related(id, { locale, signal }),
    enabled: Boolean(id),
  })
}

export function useHotels(filters: HotelFilters = {}) {
  const locale = useLocale() as Locale
  return useQuery({
    queryKey: queryKeys.hotels.list(locale, filters),
    queryFn: ({ signal }) => hotelsApi.list(filters, { locale, signal }),
  })
}

export function useHotel(id: string) {
  const locale = useLocale() as Locale
  return useQuery({
    queryKey: queryKeys.hotels.detail(locale, id),
    queryFn: ({ signal }) => hotelsApi.detail(id, { locale, signal }),
    enabled: Boolean(id),
  })
}

export function useHotelRooms(id: string, range: { checkIn?: string; checkOut?: string }) {
  const locale = useLocale() as Locale
  return useQuery({
    queryKey: queryKeys.hotels.rooms(locale, id, range),
    queryFn: ({ signal }) =>
      hotelsApi.rooms(id, { checkIn: range.checkIn!, checkOut: range.checkOut! }, { locale, signal }),
    // The backend requires both dates, so do not fire a request that must fail.
    enabled: Boolean(id && range.checkIn && range.checkOut),
  })
}

export function useGuides(filters: GuideFilters = {}) {
  const locale = useLocale() as Locale
  return useQuery({
    queryKey: queryKeys.guides.list(locale, filters),
    queryFn: ({ signal }) => guidesApi.list(filters, { locale, signal }),
  })
}

export function useGuide(id: string) {
  const locale = useLocale() as Locale
  return useQuery({
    queryKey: queryKeys.guides.detail(locale, id),
    queryFn: ({ signal }) => guidesApi.detail(id, { locale, signal }),
    enabled: Boolean(id),
  })
}

export function useVehicles(filters: VehicleFilters = {}) {
  const locale = useLocale() as Locale
  return useQuery({
    queryKey: queryKeys.transport.list(locale, filters),
    queryFn: ({ signal }) => transportApi.list(filters, { locale, signal }),
  })
}

export function useVehicle(id: string) {
  const locale = useLocale() as Locale
  return useQuery({
    queryKey: queryKeys.transport.detail(locale, id),
    queryFn: ({ signal }) => transportApi.detail(id, { locale, signal }),
    enabled: Boolean(id),
  })
}

export function usePlaces(filters: PlaceFilters = {}) {
  const locale = useLocale() as Locale
  return useQuery({
    queryKey: queryKeys.places.list(locale, filters),
    queryFn: ({ signal }) => placesApi.list(filters, { locale, signal }),
  })
}

export function usePlace(id: string) {
  const locale = useLocale() as Locale
  return useQuery({
    queryKey: queryKeys.places.detail(locale, id),
    queryFn: ({ signal }) => placesApi.detail(id, { locale, signal }),
    enabled: Boolean(id),
  })
}

/**
 * Global search. Disabled below two characters because the backend rejects
 * shorter terms with SRCH_QUERY_TOO_SHORT.
 */
export function useSearch(term: string, options?: { limit?: number }) {
  const locale = useLocale() as Locale
  const trimmed = term.trim()
  return useQuery({
    queryKey: queryKeys.search.query(locale, trimmed, options ?? {}),
    queryFn: ({ signal }) => searchApi.query(trimmed, options ?? {}, { locale, signal }),
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  })
}
