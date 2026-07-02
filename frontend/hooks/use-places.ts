'use client'

import { useApiQuery, type ApiQueryResult } from '@/lib/use-api-query'
import { buildQuery } from '@/lib/api-client'
import { useLanguageStore } from '@/lib/i18n'
import type { Paginated } from '@/types/api'
import type { PlaceSummary } from '@/types/domain'
import type { PlaceCategoryFilter } from '@/types/explore'

/** Default page size for the Explore Places list (Requirement 4.2, 4.9). */
export const PLACES_PAGE_SIZE = 12

export interface UsePlacesParams {
  /** Category filter sent to the backend (`null` = all categories). */
  category?: PlaceCategoryFilter | null
  /** 1-based page number. */
  page?: number
  /** Page size; defaults to {@link PLACES_PAGE_SIZE}. */
  limit?: number
}

/**
 * Fetch a paginated page of places from `GET /v1/places`, filtered by category.
 *
 * The active locale is forwarded as `lang` so the backend returns localized
 * place names (Requirement 13.7). Price-range filtering is applied client-side
 * by the caller (see {@link filterPlacesByPrice}); the API exposes only a
 * `category` filter.
 */
export function usePlaces({
  category,
  page = 1,
  limit = PLACES_PAGE_SIZE,
}: UsePlacesParams = {}): ApiQueryResult<Paginated<PlaceSummary>> {
  const locale = useLanguageStore((s) => s.locale)
  const path = `/v1/places${buildQuery({
    category: category ?? undefined,
    page,
    limit,
    lang: locale,
  })}`
  return useApiQuery<Paginated<PlaceSummary>>(path)
}
