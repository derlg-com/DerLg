'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ExploreSearch } from './ExploreSearch'
import { PlaceFilters } from './PlaceFilters'
import { PlaceGrid } from './PlaceGrid'
import { Pagination } from '@/components/ui/pagination'
import { useDebounce } from '@/hooks/use-debounce'
import { usePlaces } from '@/hooks/use-places'
import { useTranslations } from '@/lib/i18n'
import {
  filterPlacesByPrice,
  filterPlacesByQuery,
  resolveExploreQuery,
  resolvePlaceCategory,
  resolvePlacePrice,
} from '@/types/explore'
import type { PlaceSummary } from '@/types/domain'

/**
 * Explore → Places tab (task 8.2). Fetches places from `GET /v1/places`,
 * renders category + price filters, the results grid (with loading skeletons,
 * error/retry, and empty states), and pagination.
 *
 * Filter + page state lives entirely in the URL query (`category`, `price`,
 * `page`) so selections are shareable and survive reload (Requirement 4.7,
 * 4.8) — consistent with {@link TripsCatalog}. The `tab` param is preserved so
 * the Explore shell keeps the Places tab active.
 *
 * Category filtering is applied server-side (the only filter the API supports);
 * price filtering and free-text search are applied client-side over the current
 * page via {@link filterPlacesByPrice} / {@link filterPlacesByQuery}. The search
 * box is debounced and its query persisted in the URL `?q=` param
 * (Requirement 4.5). Cards link to `?place=<id>` (merged with the current query)
 * so the detail modal added in task 8.5 can open from the URL.
 */
export function PlacesTab() {
  const t = useTranslations('explore.places')
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const category = resolvePlaceCategory(params.get('category'))
  const price = resolvePlacePrice(params.get('price'))
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)

  // Search query: seeded from the URL (`?q=`), debounced locally before being
  // pushed back to the URL and used to filter the loaded page (Requirement 4.5).
  const urlQuery = resolveExploreQuery(params.get('q'))
  const [query, setQuery] = useState(urlQuery)
  const debouncedQuery = useDebounce(query)

  const setParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  // Sync the debounced query into the URL (resetting paging) when it changes.
  useEffect(() => {
    const trimmed = debouncedQuery.trim()
    if (trimmed === urlQuery) return
    setParams({ q: trimmed || null, page: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery])

  const { data, isLoading, error, refetch } = usePlaces({ category, page })

  // Price + query are filtered client-side (the API has neither filter), so
  // apply them to the current page of results before rendering.
  const visiblePlaces = useMemo(
    () => filterPlacesByQuery(filterPlacesByPrice(data?.items ?? [], price), urlQuery),
    [data?.items, price, urlQuery],
  )

  const hrefFor = (place: PlaceSummary) => {
    const next = new URLSearchParams(params.toString())
    next.set('place', place.id)
    const qs = next.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const clearFilters = () => {
    setQuery('')
    setParams({ category: null, price: null, page: null, q: null })
  }

  return (
    <div className="space-y-4">
      <ExploreSearch
        value={query}
        onChange={setQuery}
        label={t('search.placeholder')}
        placeholder={t('search.placeholder')}
      />

      <PlaceFilters
        category={category}
        price={price}
        onCategoryChange={(c) => setParams({ category: c, page: null })}
        onPriceChange={(p) => setParams({ price: p === 'all' ? null : p, page: null })}
      />

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {data ? t('resultsCount', { count: visiblePlaces.length }) : '\u00a0'}
      </p>

      <PlaceGrid
        places={visiblePlaces}
        isLoading={isLoading}
        isError={Boolean(error)}
        hrefFor={hrefFor}
        onRetry={refetch}
        onClearFilters={clearFilters}
      />

      {/* Pagination reflects the server-side (category) result set. Client-side
          price filtering only narrows the current page. */}
      {data && data.totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={data.totalPages}
          onPageChange={(p) => setParams({ page: p > 1 ? String(p) : null })}
        />
      ) : null}
    </div>
  )
}
