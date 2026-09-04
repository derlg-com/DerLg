'use client'

import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'

import { queryKeys } from '@/lib/api/query-keys'
import { guidesApi, transportApi } from '@/lib/api/resources'
import type { Locale } from '@/lib/i18n/config'

/**
 * Availability for a guide or vehicle over a date window.
 *
 * The API answers with busy ranges rather than a boolean, so callers invert it:
 * an empty list means free for the whole window. Disabled until both dates are
 * present, because the backend rejects a partial range.
 */
export function useGuideAvailability(id: string, range: { from?: string; to?: string }) {
  const locale = useLocale() as Locale
  const enabled = Boolean(id && range.from && range.to && range.to > range.from)

  return useQuery({
    queryKey: queryKeys.guides.availability(locale, id, {
      from: range.from ?? '',
      to: range.to ?? '',
    }),
    queryFn: ({ signal }) =>
      guidesApi.availability(id, { from: range.from!, to: range.to! }, { locale, signal }),
    enabled,
  })
}

export function useVehicleAvailability(id: string, range: { from?: string; to?: string }) {
  const locale = useLocale() as Locale
  const enabled = Boolean(id && range.from && range.to && range.to > range.from)

  return useQuery({
    queryKey: queryKeys.transport.availability(locale, id, {
      from: range.from ?? '',
      to: range.to ?? '',
    }),
    queryFn: ({ signal }) =>
      transportApi.availability(id, { from: range.from!, to: range.to! }, { locale, signal }),
    enabled,
  })
}
