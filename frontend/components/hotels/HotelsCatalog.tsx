'use client'

import { useState } from 'react'
import { SlidersHorizontal, Hotel as HotelIcon } from 'lucide-react'
import { useApiQuery } from '@/lib/use-api-query'
import { buildQuery } from '@/lib/api-client'
import { HotelCard } from './HotelCard'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/i18n'
import {
  HOTEL_SORTS,
  HOTEL_AMENITIES,
  CAMBODIA_LOCATIONS,
  type HotelSort,
  type HotelSummary,
} from '@/types/catalog'
import type { Paginated } from '@/types/api'

const LIMIT = 12

const PRICE_RANGES = [
  { key: 'any', min: undefined, max: undefined },
  { key: 'lt100', min: undefined, max: 100 },
  { key: 'r100_300', min: 100, max: 300 },
  { key: 'gt300', min: 300, max: undefined },
] as const
type PriceKey = (typeof PRICE_RANGES)[number]['key']

export function HotelsCatalog() {
  const t = useTranslations('hotels')
  const [location, setLocation] = useState('')
  const [priceKey, setPriceKey] = useState<PriceKey>('any')
  const [starRating, setStarRating] = useState(0)
  const [amenities, setAmenities] = useState<string[]>([])
  const [sort, setSort] = useState<HotelSort>('recommended')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const range = PRICE_RANGES.find((r) => r.key === priceKey) ?? PRICE_RANGES[0]
  const activeCount =
    (location ? 1 : 0) + (priceKey !== 'any' ? 1 : 0) + (starRating ? 1 : 0) + amenities.length

  const path = `/v1/hotels${buildQuery({
    location: location || undefined,
    minPrice: range.min,
    maxPrice: range.max,
    starRating: starRating || undefined,
    amenities,
    sort,
    page,
    limit: LIMIT,
  })}`
  const { data, isLoading, error, refetch } = useApiQuery<Paginated<HotelSummary>>(path)

  function toggleAmenity(a: string) {
    setPage(1)
    setAmenities((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]))
  }
  function clearFilters() {
    setLocation('')
    setPriceKey('any')
    setStarRating(0)
    setAmenities([])
    setPage(1)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal className="mr-1 h-4 w-4" aria-hidden />
          {t('filters.title')}
          {activeCount > 0 ? ` (${activeCount})` : ''}
        </Button>
        <div className="w-44">
          <Select
            value={sort}
            onChange={(e) => {
              setPage(1)
              setSort(e.target.value as HotelSort)
            }}
            aria-label={t('filters.sort')}
          >
            {HOTEL_SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`sort.${s}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title={t('error.title')}
          description={t('error.desc')}
          action={
            <Button variant="outline" size="sm" onClick={refetch}>
              {t('error.retry')}
            </Button>
          }
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={HotelIcon}
          title={t('empty.title')}
          description={t('empty.desc')}
          action={
            activeCount > 0 ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                {t('empty.clear')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.items.map((hotel) => (
              <HotelCard key={hotel.id} hotel={hotel} />
            ))}
          </div>
          {data.totalPages > 1 ? (
            <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
          ) : null}
        </>
      )}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" title={t('filters.title')}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="f-location">{t('filters.location')}</Label>
              <Select
                id="f-location"
                value={location}
                onChange={(e) => {
                  setPage(1)
                  setLocation(e.target.value)
                }}
              >
                <option value="">{t('filters.anyLocation')}</option>
                {CAMBODIA_LOCATIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-price">{t('filters.price')}</Label>
              <Select
                id="f-price"
                value={priceKey}
                onChange={(e) => {
                  setPage(1)
                  setPriceKey(e.target.value as PriceKey)
                }}
              >
                {PRICE_RANGES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {t(`filters.priceRanges.${r.key}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-star">{t('filters.star')}</Label>
              <Select
                id="f-star"
                value={String(starRating)}
                onChange={(e) => {
                  setPage(1)
                  setStarRating(Number(e.target.value))
                }}
              >
                <option value="0">{t('filters.anyStar')}</option>
                {[5, 4, 3, 2, 1].map((s) => (
                  <option key={s} value={s}>
                    {t('filters.starPlus', { n: s })}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('filters.amenities')}</Label>
              <div className="flex flex-wrap gap-2">
                {HOTEL_AMENITIES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={amenities.includes(a)}
                    onClick={() => toggleAmenity(a)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm transition-colors',
                      amenities.includes(a)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={clearFilters}>
              {t('empty.clear')}
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              {t('filters.done')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
