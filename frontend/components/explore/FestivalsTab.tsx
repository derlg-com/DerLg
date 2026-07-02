'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ExploreSearch } from './ExploreSearch'
import { FestivalFilters } from './FestivalFilters'
import { FestivalGrid } from './FestivalGrid'
import { Pagination } from '@/components/ui/pagination'
import { useDebounce } from '@/hooks/use-debounce'
import { useFestivals } from '@/hooks/use-festivals'
import { useTranslations } from '@/lib/i18n'
import {
  festivalProvinces,
  filterFestivals,
  filterFestivalsByQuery,
  resolveExploreQuery,
  resolveFestivalMonth,
  resolveFestivalProvince,
  resolveFestivalTime,
} from '@/types/explore'

/**
 * Explore → Festivals tab (task 8.3). Fetches festivals from
 * `GET /v1/festivals`, renders time + date (month) + location (province)
 * filters, the results grid (with loading skeletons, error/retry, and empty
 * states), and pagination — mirroring {@link PlacesTab}.
 *
 * Filter + page state lives entirely in the URL query (`time`, `month`,
 * `province`, `page`) so selections are shareable and survive reload
 * (Requirement 4.7, 4.8). The `tab` param is preserved so the Explore shell
 * keeps the Festivals tab active.
 *
 * The time filter (upcoming/all) is applied server-side via the `upcoming`
 * query param (the only filter the public list contract supports). Month (date)
 * and province (location) filtering, plus free-text search, are applied
 * client-side over the loaded page via {@link filterFestivals} /
 * {@link filterFestivalsByQuery}. The search box is debounced and its query
 * persisted in the URL `?q=` param (Requirement 4.5), since the list endpoint
 * exposes no date/location/search query params — consistent with how the Places
 * tab applies its price filter client-side. Cards link to `/festivals/<id>`
 * (task 7.3).
 */
export function FestivalsTab() {
  const t = useTranslations('explore.festivals')
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const time = resolveFestivalTime(params.get('time'))
  const month = resolveFestivalMonth(params.get('month'))
  const province = resolveFestivalProvince(params.get('province'))
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

  const { data, isLoading, error, refetch } = useFestivals({ time, page })

  const items = useMemo(() => data?.items ?? [], [data?.items])

  // Province options are derived from the loaded page of festivals.
  const provinces = useMemo(() => festivalProvinces(items), [items])

  // Month + province + query are filtered client-side (the API has no such
  // filters), so apply them to the current page of results before rendering.
  const visibleFestivals = useMemo(
    () => filterFestivalsByQuery(filterFestivals(items, { month, province }), urlQuery),
    [items, month, province, urlQuery],
  )

  const clearFilters = () => {
    setQuery('')
    setParams({ month: null, province: null, page: null, time: null, q: null })
  }

  return (
    <div className="space-y-4">
      <ExploreSearch
        value={query}
        onChange={setQuery}
        label={t('search.placeholder')}
        placeholder={t('search.placeholder')}
      />

      <FestivalFilters
        time={time}
        month={month}
        province={province}
        provinces={provinces}
        onTimeChange={(time) => setParams({ time: time === 'upcoming' ? null : time, page: null })}
        onMonthChange={(m) => setParams({ month: m == null ? null : String(m), page: null })}
        onProvinceChange={(p) => setParams({ province: p, page: null })}
      />

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {data ? t('resultsCount', { count: visibleFestivals.length }) : '\u00a0'}
      </p>

      <FestivalGrid
        festivals={visibleFestivals}
        isLoading={isLoading}
        isError={Boolean(error)}
        onRetry={refetch}
        onClearFilters={clearFilters}
      />

      {/* Pagination reflects the server-side (time) result set. Client-side
          month/province filtering only narrows the current page. */}
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
