'use client'

import { useTranslations } from 'next-intl'

import { CardMedia } from '@/components/shared/card-media'
import { FilterBar } from '@/components/shared/filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { Price } from '@/components/shared/price'
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  Field,
  LoadingRegion,
  Select,
  Skeleton,
} from '@/components/ui'
import { useVehicles } from '@/hooks/use-catalog'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { Link } from '@/lib/i18n/navigation'
import { VEHICLE_TYPES } from '@/schemas/domain'

const DEFAULTS = {
  // The backend DTO names this `type`; `vehicleType` is rejected outright.
  type: undefined as string | undefined,
  page: undefined as string | undefined,
}

const PAGE_SIZE = 12

/** Renders `tuk_tuk` as "tuk tuk" without inventing a translation key. */
function readableType(value: string): string {
  return value.replace(/_/g, ' ')
}

export function TransportBrowser() {
  const t = useTranslations('transportation')
  const catalog = useTranslations('catalog')
  const common = useTranslations('common')
  const search = useTranslations('search')

  const { filters, setFilters, clearFilters, activeCount } = useUrlFilters(DEFAULTS)
  const page = Number(filters.page ?? '1')

  const { data, isPending, isError, refetch } = useVehicles({
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: PAGE_SIZE,
    type: filters.type,
  })

  return (
    <div className="space-y-6">
      <FilterBar activeCount={activeCount} onClear={clearFilters}>
        <Field label={catalog('filters.vehicleType')} className="min-w-48">
          {(props) => (
            <Select
              {...props}
              value={filters.type ?? ''}
              onChange={(event) => setFilters({ type: event.target.value || undefined })}
            >
              <option value="">{catalog('filters.anyVehicle')}</option>
              {VEHICLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {readableType(type)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </FilterBar>

      {isPending ? (
        <LoadingRegion label={common('loading')}>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <li key={index}>
                <Card className="overflow-hidden">
                  <Skeleton className="aspect-video w-full rounded-none" />
                  <CardContent className="space-y-2 pt-4">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </LoadingRegion>
      ) : isError ? (
        <ErrorState
          title={common('error')}
          onRetry={() => void refetch()}
          retryLabel={common('tryAgain')}
        />
      ) : data.items.length === 0 ? (
        <EmptyState
          title={search('noResultsDesc')}
          action={
            activeCount > 0 ? (
              <Link
                href="/transport"
                className="inline-flex min-h-9 items-center rounded-md border border-[var(--border-default)] px-3 text-sm font-medium hover:bg-[var(--surface-hover)] pointer-coarse:min-h-11"
              >
                {catalog('filters.clear')}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
            {data.total}
          </p>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((vehicle) => (
              <li key={vehicle.id}>
                <Card interactive as="article" className="h-full overflow-hidden">
                  <Link
                    href={`/transport/${vehicle.id}`}
                    className="block h-full focus-visible:outline-none"
                  >
                    <CardMedia src={vehicle.coverImage} ratio="16/9" />
                    <CardContent className="space-y-2 pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="line-clamp-1 text-base leading-tight font-semibold tracking-tight">
                          {vehicle.name}
                        </h2>
                        <Badge tone="neutral">{readableType(vehicle.vehicleType)}</Badge>
                      </div>

                      <p className="text-sm text-[var(--text-secondary)]">
                        {vehicle.capacity} {t('card.seats')}
                        {vehicle.province ? ` · ${vehicle.province}` : ''}
                      </p>

                      <p className="text-sm">
                        <Price
                          amountUsd={vehicle.priceUsd}
                          className="font-semibold text-[var(--text-primary)]"
                          // The pricing model matters: $6 per km is not $6 per trip.
                          suffix={vehicle.pricingModel ? readableType(vehicle.pricingModel) : undefined}
                        />
                      </p>
                    </CardContent>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onPageChange={(next) => setFilters({ page: next === 1 ? undefined : String(next) })}
          />
        </>
      )}
    </div>
  )
}
