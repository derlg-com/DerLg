'use client'

import { useApiQuery, type ApiQueryResult } from '@/lib/use-api-query'
import { buildQuery } from '@/lib/api-client'
import { useLanguageStore } from '@/lib/i18n'
import type { Paginated } from '@/types/api'
import type { FestivalSummary } from '@/types/domain'
import type { FestivalTimeFilter } from '@/types/explore'

/** Default page size for the Explore Festivals list (Requirement 4.3, 4.9). */
export const FESTIVALS_PAGE_SIZE = 12

export interface UseFestivalsParams {
  /** Time filter sent to the backend as `upcoming` (`'upcoming'` => true). */
  time?: FestivalTimeFilter
  /** 1-based page number. */
  page?: number
  /** Page size; defaults to {@link FESTIVALS_PAGE_SIZE}. */
  limit?: number
}

/**
 * Fetch a paginated page of festivals from `GET /v1/festivals`, optionally
 * limited to upcoming festivals.
 *
 * The active locale is forwarded as `lang` so the backend returns localized
 * festival names (Requirement 13.7). Month/province filtering is applied
 * client-side by the caller (see {@link filterFestivals}); the public list
 * contract exposes only `upcoming` (+ pagination), mirroring how the Places
 * tab applies its price filter client-side (task 8.2).
 */
export function useFestivals({
  time = 'upcoming',
  page = 1,
  limit = FESTIVALS_PAGE_SIZE,
}: UseFestivalsParams = {}): ApiQueryResult<Paginated<FestivalSummary>> {
  const locale = useLanguageStore((s) => s.locale)
  const path = `/v1/festivals${buildQuery({
    upcoming: time === 'upcoming' ? true : undefined,
    page,
    limit,
    lang: locale,
  })}`
  return useApiQuery<Paginated<FestivalSummary>>(path)
}
