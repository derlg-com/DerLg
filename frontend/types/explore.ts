/**
 * Explore screen (Places tab) filter types and pure helpers — task 8.2.
 *
 * The backend `GET /v1/places` endpoint only filters by `category` (plus
 * pagination); see `backend/src/modules/places/dto/list-places.dto.ts`. The
 * `PlaceSummary` payload carries `category` and `entryFeeUsd` but no
 * province/region field, so:
 *
 * - **Category** is applied server-side (the single supported list filter).
 * - **Price range** is applied client-side over the loaded page using
 *   `entryFeeUsd` (free vs. paid buckets), since the API exposes no price filter.
 *
 * Region filtering (Requirement 4.2) is not representable against the current
 * backend contract (no region/province on `PlaceSummary`) and is therefore not
 * offered here; it can be added once the API surfaces a region field.
 */

import type { PlaceSummary } from './domain'

/**
 * Place categories the backend list endpoint accepts as the `category` query
 * param. Must stay in sync with `PlaceCategoryFilter` in the backend DTO.
 */
export const PLACE_CATEGORIES = [
  'temple',
  'museum',
  'nature',
  'market',
  'beach',
  'mountain',
] as const

export type PlaceCategoryFilter = (typeof PLACE_CATEGORIES)[number]

/** Client-side price buckets applied to `entryFeeUsd`. */
export const PLACE_PRICE_FILTERS = ['all', 'free', 'paid'] as const

export type PlacePriceFilter = (typeof PLACE_PRICE_FILTERS)[number]

export const DEFAULT_PLACE_PRICE: PlacePriceFilter = 'all'

/**
 * Resolve a raw `?category=` value to a known place category, or `null` when
 * missing/unrecognized (meaning "all categories").
 */
export function resolvePlaceCategory(raw: string | null | undefined): PlaceCategoryFilter | null {
  return PLACE_CATEGORIES.includes(raw as PlaceCategoryFilter) ? (raw as PlaceCategoryFilter) : null
}

/**
 * Resolve a raw `?price=` value to a known price filter, falling back to the
 * default (`all`) for missing/unrecognized values.
 */
export function resolvePlacePrice(raw: string | null | undefined): PlacePriceFilter {
  return PLACE_PRICE_FILTERS.includes(raw as PlacePriceFilter)
    ? (raw as PlacePriceFilter)
    : DEFAULT_PLACE_PRICE
}

/**
 * Treat a place as free when it has no entry fee or the fee is zero (or, for
 * defensiveness against malformed data, negative).
 */
export function isFreePlace(place: Pick<PlaceSummary, 'entryFeeUsd'>): boolean {
  return place.entryFeeUsd == null || place.entryFeeUsd <= 0
}

/**
 * Apply the client-side price filter to a list of places. Pure and total:
 * `all` returns the list unchanged; `free`/`paid` partition by {@link isFreePlace}.
 */
export function filterPlacesByPrice(
  places: PlaceSummary[],
  price: PlacePriceFilter,
): PlaceSummary[] {
  if (price === 'all') return places
  if (price === 'free') return places.filter((p) => isFreePlace(p))
  return places.filter((p) => !isFreePlace(p))
}

// =============================================================================
// Explore → Festivals tab filter types and pure helpers — task 8.3.
//
// The frontend festivals list contract (`GET /v1/festivals`, as already consumed
// by the Home/Explore landing shelves built in task 7.3) accepts an `upcoming`
// boolean plus pagination (`page`/`limit`) and `lang`. It does not expose
// server-side `date`/`location` query params on the public list endpoint, so —
// mirroring how the Places tab (task 8.2) applies price client-side:
//
// - **Time** (`upcoming` vs. `all`) is applied server-side via the `upcoming`
//   query param (the single supported list filter).
// - **Province/location** (Requirement 4.3 "location") is applied client-side
//   over the loaded page using `FestivalSummary.province` / `.location`.
// - **Month** (Requirement 4.3 "date") is applied client-side over the loaded
//   page by testing whether a festival's [startDate, endDate] range overlaps the
//   selected calendar month.
//
// All resolvers/filters below are pure and total so they can be unit-tested in
// isolation and reused by the tab without React.

import type { FestivalSummary } from './domain'

/** Festival time filter applied server-side via the `upcoming` query param. */
export const FESTIVAL_TIME_FILTERS = ['upcoming', 'all'] as const

export type FestivalTimeFilter = (typeof FESTIVAL_TIME_FILTERS)[number]

export const DEFAULT_FESTIVAL_TIME: FestivalTimeFilter = 'upcoming'

/**
 * Festival categories offered as color-coded markers and type filters
 * (Requirement 41.2, 41.5). `other` is the catch-all bucket for festivals
 * whose `type` is absent or unrecognised, so filtering and color-coding stay
 * total even when the backend omits the field.
 */
export const FESTIVAL_TYPES = ['religious', 'cultural', 'music', 'food', 'other'] as const

export type FestivalTypeFilter = (typeof FESTIVAL_TYPES)[number]

/**
 * Tailwind utility classes for each festival type's calendar marker/badge
 * (background + text). Kept here (pure data) so both the calendar view and the
 * legend stay in sync.
 */
export const FESTIVAL_TYPE_CLASSES: Record<FestivalTypeFilter, string> = {
  religious: 'bg-amber-500 text-white',
  cultural: 'bg-violet-500 text-white',
  music: 'bg-sky-500 text-white',
  food: 'bg-rose-500 text-white',
  other: 'bg-muted-foreground/70 text-background',
}

/**
 * Normalise a festival's (optional) `type` to a known {@link FestivalTypeFilter},
 * bucketing missing/unrecognised values as `other`. Pure and total.
 */
export function resolveFestivalType(raw: string | null | undefined): FestivalTypeFilter {
  const v = raw?.toLowerCase().trim()
  return FESTIVAL_TYPES.includes(v as FestivalTypeFilter) ? (v as FestivalTypeFilter) : 'other'
}

/**
 * Filter festivals by category. A `null` filter (or `other` matching the
 * fallback bucket) is handled correctly: `null` returns everything; an explicit
 * type returns only festivals resolving to it. Pure and total.
 */
export function filterFestivalsByType(
  festivals: FestivalSummary[],
  type: FestivalTypeFilter | null,
): FestivalSummary[] {
  if (type == null) return festivals
  return festivals.filter((f) => resolveFestivalType(f.type) === type)
}

/** Sentinel `?month=` value (and select option) meaning "any month". */
export const FESTIVAL_MONTH_ANY = 'all'

/**
 * Resolve a raw `?time=` value to a known festival time filter, falling back to
 * the default (`upcoming`) for missing/unrecognized values.
 */
export function resolveFestivalTime(raw: string | null | undefined): FestivalTimeFilter {
  return FESTIVAL_TIME_FILTERS.includes(raw as FestivalTimeFilter)
    ? (raw as FestivalTimeFilter)
    : DEFAULT_FESTIVAL_TIME
}

/**
 * Resolve a raw `?month=` value to a 1–12 month number, or `null` for
 * missing/unrecognized values (meaning "any month"). Accepts the
 * {@link FESTIVAL_MONTH_ANY} sentinel and out-of-range/non-numeric input as
 * "any".
 */
export function resolveFestivalMonth(raw: string | null | undefined): number | null {
  if (raw == null || raw === '' || raw === FESTIVAL_MONTH_ANY) return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null
}

/**
 * Resolve a raw `?province=` value to a trimmed province string, or `null` when
 * missing/blank (meaning "any province"). The set of provinces offered in the
 * UI is derived from the loaded festivals (see {@link festivalProvinces}).
 */
export function resolveFestivalProvince(raw: string | null | undefined): string | null {
  const v = raw?.trim()
  return v ? v : null
}

/**
 * Distinct, sorted province labels present in the loaded festivals, used to
 * populate the province filter. Falls back to `location` when `province` is
 * absent so the filter still offers something meaningful. Pure.
 */
export function festivalProvinces(festivals: FestivalSummary[]): string[] {
  const set = new Set<string>()
  for (const f of festivals) {
    const label = f.province ?? f.location
    if (label && label.trim()) set.add(label.trim())
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

/**
 * Whether a festival's inclusive [startDate, endDate] range overlaps the given
 * 1–12 calendar `month` (in any year). Pure and total: malformed dates simply
 * don't match. A range spanning a year boundary (e.g. Dec→Jan) matches both
 * endpoint months and every month in between.
 */
export function festivalInMonth(
  festival: Pick<FestivalSummary, 'startDate' | 'endDate'>,
  month: number,
): boolean {
  const start = new Date(festival.startDate)
  const end = new Date(festival.endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false
  if (end.getTime() < start.getTime()) return false

  // Walk months from start to end (capped to a year) and check for the target.
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)
  for (let i = 0; i < 12 && cursor.getTime() <= last.getTime(); i++) {
    if (cursor.getMonth() + 1 === month) return true
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return false
}

/**
 * Whether a festival matches the selected province/location. Matches against
 * `province` first, then `location`, case-insensitively. A `null` filter
 * matches everything. Pure and total.
 */
export function festivalInProvince(
  festival: Pick<FestivalSummary, 'province' | 'location'>,
  province: string | null,
): boolean {
  if (province == null) return true
  const target = province.trim().toLowerCase()
  if (!target) return true
  const label = (festival.province ?? festival.location ?? '').trim().toLowerCase()
  return label === target
}

/**
 * Apply the client-side festival filters (month + province) to a loaded page of
 * festivals. Pure and total; `null` filters are no-ops. The server-side time
 * filter (`upcoming`) is applied by the API and is not re-applied here.
 */
export function filterFestivals(
  festivals: FestivalSummary[],
  filters: { month: number | null; province: string | null },
): FestivalSummary[] {
  return festivals.filter(
    (f) =>
      (filters.month == null || festivalInMonth(f, filters.month)) &&
      festivalInProvince(f, filters.province),
  )
}

// =============================================================================
// Explore → text search (Places + Festivals) — task 8.4 (Requirement 4.5).
//
// The Explore Places/Festivals list endpoints expose no free-text `q` query
// param (see use-places.ts / use-festivals.ts — only `category`/`upcoming` +
// pagination). So, mirroring how price (places) and month/province (festivals)
// are applied client-side over the loaded page, the search box filters the
// already-loaded page by a debounced query. State lives in the URL (`?q=`) so
// it is shareable and survives reload (Requirement 4.7, 4.8).
//
// Matching is case-insensitive substring on the user-facing fields. The query
// is trimmed; a blank query is a no-op (returns the list unchanged). All helpers
// are pure and total so they can be unit-tested in isolation.
// =============================================================================

/** Minimum trimmed query length before a search is considered active. */
export const EXPLORE_SEARCH_MIN_LENGTH = 1

/**
 * Normalize a raw `?q=` value (or input value) for searching: trims whitespace
 * and lowercases. Returns `''` for missing/blank input (meaning "no query").
 */
export function resolveExploreQuery(raw: string | null | undefined): string {
  return raw?.trim() ?? ''
}

/** Whether a normalized query is long enough to filter on. */
export function isExploreQueryActive(query: string): boolean {
  return query.trim().length >= EXPLORE_SEARCH_MIN_LENGTH
}

/**
 * Filter places by a free-text query (case-insensitive substring on `name`).
 * A blank/short query returns the list unchanged. Pure and total.
 */
export function filterPlacesByQuery(places: PlaceSummary[], query: string): PlaceSummary[] {
  const q = query.trim().toLowerCase()
  if (!isExploreQueryActive(q)) return places
  return places.filter((p) => p.name.toLowerCase().includes(q))
}

/**
 * Filter festivals by a free-text query (case-insensitive substring on `name`,
 * `province`, or `location`). A blank/short query returns the list unchanged.
 * Pure and total.
 */
export function filterFestivalsByQuery(
  festivals: FestivalSummary[],
  query: string,
): FestivalSummary[] {
  const q = query.trim().toLowerCase()
  if (!isExploreQueryActive(q)) return festivals
  return festivals.filter((f) => {
    const haystack = [f.name, f.province ?? '', f.location ?? ''].join(' ').toLowerCase()
    return haystack.includes(q)
  })
}
