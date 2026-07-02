'use client'

import { useApiQuery, type ApiQueryResult } from '@/lib/use-api-query'
import { buildQuery } from '@/lib/api-client'
import { useLanguageStore } from '@/lib/i18n'
import type { TripSummary, HotelSummary } from '@/types/catalog'

/**
 * Related content for a festival (Requirement 41.6: related trips and
 * accommodations).
 *
 * BACKEND-CONTRACT ASSUMPTION: the backend does not currently expose a
 * `GET /v1/festivals/{id}/related` endpoint. This hook assumes that future
 * contract returning `{ trips, hotels }` and degrades gracefully — on any error
 * (including 404 when the endpoint is absent) it surfaces empty arrays via the
 * standard {@link ApiQueryResult} `error`, and the detail view simply hides the
 * "related" sections. The `lang` param is forwarded for localized names
 * (Requirement 13.7).
 */
export interface FestivalRelated {
  trips: TripSummary[]
  hotels: HotelSummary[]
}

export function useFestivalRelated(id: string): ApiQueryResult<FestivalRelated> {
  const locale = useLanguageStore((s) => s.locale)
  const path = `/v1/festivals/${id}/related${buildQuery({ lang: locale })}`
  // retry: 0 — when the endpoint is absent (404/network), don't hammer it;
  // the section just stays hidden. Transient backend errors still surface.
  return useApiQuery<FestivalRelated>(path, { retry: 0 })
}
