'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useApiQuery } from '@/lib/use-api-query'
import { buildQuery } from '@/lib/api-client'
import { CategoryRow } from './CategoryRow'
import { TripGrid } from './TripGrid'
import { Select } from '@/components/ui/select'
import { Pagination } from '@/components/ui/pagination'
import { useTranslations } from '@/lib/i18n'
import {
  TRIP_CATEGORIES,
  TRIP_SORTS,
  type TripCategory,
  type TripSort,
  type TripSummary,
} from '@/types/catalog'
import type { Paginated } from '@/types/api'

const LIMIT = 12

export function TripsCatalog() {
  const t = useTranslations('trips')
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const rawCategory = params.get('category')
  const category = TRIP_CATEGORIES.includes(rawCategory as TripCategory)
    ? (rawCategory as TripCategory)
    : null
  const rawSort = params.get('sort')
  const sort = TRIP_SORTS.includes(rawSort as TripSort) ? (rawSort as TripSort) : 'featured'
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)

  const setParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const path = `/v1/trips${buildQuery({ category: category?.toLowerCase(), sort, page, limit: LIMIT })}`
  const { data, isLoading, error, refetch } = useApiQuery<Paginated<TripSummary>>(path)

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <div className="space-y-3">
        <CategoryRow selected={category} onSelect={(c) => setParams({ category: c, page: null })} />
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {data ? t('list.resultsCount', { count: data.total }) : '\u00a0'}
          </p>
          <div className="w-44">
            <Select
              value={sort}
              onChange={(e) => setParams({ sort: e.target.value, page: null })}
              aria-label={t('list.sortLabel')}
            >
              {TRIP_SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(`list.sort.${s}`)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <TripGrid
        trips={data?.items ?? []}
        isLoading={isLoading}
        isError={Boolean(error)}
        onRetry={refetch}
        onClearFilters={() => setParams({ category: null, sort: null, page: null })}
      />

      {data && data.totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={data.totalPages}
          onPageChange={(p) => setParams({ page: String(p) })}
        />
      ) : null}
    </div>
  )
}
