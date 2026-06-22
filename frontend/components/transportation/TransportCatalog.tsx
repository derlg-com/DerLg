'use client'

import { useState } from 'react'
import { Car } from 'lucide-react'
import { useApiQuery } from '@/lib/use-api-query'
import { buildQuery } from '@/lib/api-client'
import { VehicleCard } from './VehicleCard'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { useTranslations } from '@/lib/i18n'
import { TRANSPORT_SORTS, TRANSPORT_TYPES, type TransportSort, type VehicleSummary } from '@/types/catalog'
import type { Paginated } from '@/types/api'

const LIMIT = 12
const CAPACITIES = [0, 4, 7, 10, 15]
const MAX_PRICES = [0, 50, 100, 200]

export function TransportCatalog() {
  const t = useTranslations('transportation')
  const [type, setType] = useState('')
  const [minCapacity, setMinCapacity] = useState(0)
  const [maxPrice, setMaxPrice] = useState(0)
  const [sort, setSort] = useState<TransportSort>('price_asc')
  const [page, setPage] = useState(1)

  const path = `/v1/transportation/vehicles${buildQuery({
    type: type || undefined,
    minCapacity: minCapacity || undefined,
    maxPrice: maxPrice || undefined,
    sort,
    page,
    limit: LIMIT,
  })}`
  const { data, isLoading, error, refetch } = useApiQuery<Paginated<VehicleSummary>>(path)

  function reset() {
    setType('')
    setMinCapacity(0)
    setMaxPrice(0)
    setPage(1)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={type}
          onChange={(e) => {
            setPage(1)
            setType(e.target.value)
          }}
          aria-label={t('filters.type')}
          className="w-auto min-w-32"
        >
          <option value="">{t('filters.anyType')}</option>
          {TRANSPORT_TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {tp}
            </option>
          ))}
        </Select>
        <Select
          value={String(minCapacity)}
          onChange={(e) => {
            setPage(1)
            setMinCapacity(Number(e.target.value))
          }}
          aria-label={t('filters.capacity')}
          className="w-auto min-w-28"
        >
          {CAPACITIES.map((c) => (
            <option key={c} value={c}>
              {c === 0 ? t('filters.anyCapacity') : t('filters.seatsPlus', { n: c })}
            </option>
          ))}
        </Select>
        <Select
          value={String(maxPrice)}
          onChange={(e) => {
            setPage(1)
            setMaxPrice(Number(e.target.value))
          }}
          aria-label={t('filters.maxPrice')}
          className="w-auto min-w-28"
        >
          {MAX_PRICES.map((p) => (
            <option key={p} value={p}>
              {p === 0 ? t('filters.anyPrice') : t('filters.under', { n: p })}
            </option>
          ))}
        </Select>
        <Select
          value={sort}
          onChange={(e) => {
            setPage(1)
            setSort(e.target.value as TransportSort)
          }}
          aria-label={t('filters.sort')}
          className="ml-auto w-auto min-w-36"
        >
          {TRANSPORT_SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`sort.${s}`)}
            </option>
          ))}
        </Select>
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
          icon={Car}
          title={t('empty.title')}
          description={t('empty.desc')}
          action={
            <Button variant="outline" size="sm" onClick={reset}>
              {t('empty.clear')}
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.items.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>
          {data.totalPages > 1 ? (
            <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </div>
  )
}
