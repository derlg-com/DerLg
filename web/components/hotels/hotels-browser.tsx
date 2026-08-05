'use client'

import { useTranslations } from 'next-intl'

import { FilterBar } from '@/components/shared/filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { CardMedia } from '@/components/shared/card-media'
import { Price } from '@/components/shared/price'
import {
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingRegion,
  Select,
  Skeleton,
} from '@/components/ui'
import { useHotels } from '@/hooks/use-catalog'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { Link } from '@/lib/i18n/navigation'

const DEFAULTS = {
  q: undefined as string | undefined,
  starRating: undefined as string | undefined,
  page: undefined as string | undefined,
}

const PAGE_SIZE = 12

export function HotelsBrowser() {
  const t = useTranslations('hotels')
  const catalog = useTranslations('catalog')
  const common = useTranslations('common')
  const search = useTranslations('search')

  const { filters, setFilters, clearFilters, activeCount } = useUrlFilters(DEFAULTS)
  const page = Number(filters.page ?? '1')

  const { data, isPending, isError, refetch } = useHotels({
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: PAGE_SIZE,
    // The backend requires at least two characters, so shorter terms are dropped.
    q: filters.q && filters.q.trim().length >= 2 ? filters.q.trim() : undefined,
    starRating: filters.starRating ? Number(filters.starRating) : undefined,
  })

  return (
    <div className="space-y-6">
      <FilterBar activeCount={activeCount} onClear={clearFilters}>
        <Field label={search('placeholder')} className="min-w-56">
          {(props) => (
            <Input
              {...props}
              type="search"
              defaultValue={filters.q ?? ''}
              placeholder={search('placeholder')}
              onChange={(event) => {
                const value = event.target.value.trim()
                setFilters({ q: value.length >= 2 ? value : undefined })
              }}
            />
          )}
        </Field>

        <Field label={catalog('filters.stars')} className="min-w-40">
          {(props) => (
            <Select
              {...props}
              value={filters.starRating ?? ''}
              onChange={(event) => setFilters({ starRating: event.target.value || undefined })}
            >
              <option value="">{catalog('filters.anyStars')}</option>
              {[5, 4, 3, 2, 1].map((stars) => (
                <option key={stars} value={stars}>
                  {catalog('filters.starsValue', { count: stars })}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </FilterBar>

      {isPending ? (
        <LoadingRegion label={common('loading')}>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index}>
                <Card className="overflow-hidden">
                  <Skeleton className="aspect-[4/3] w-full rounded-none" />
                  <CardContent className="space-y-2 pt-4">
                    <Skeleton className="h-4 w-3/4" />
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
          description={common('tryAgain')}
          onRetry={() => void refetch()}
          retryLabel={common('tryAgain')}
        />
      ) : data.items.length === 0 ? (
        <EmptyState
          title={search('noResults', { query: filters.q ?? '' })}
          description={search('noResultsDesc')}
          action={
            activeCount > 0 ? (
              <Link
                href="/hotels"
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
            {data.items.map((hotel) => (
              <li key={hotel.id}>
                <Card interactive as="article" className="h-full overflow-hidden">
                  <Link
                    href={`/hotels/${hotel.id}`}
                    className="block h-full focus-visible:outline-none"
                  >
                    {/* Hotels expose `coverImage`, not `coverImageUrl`. */}
                    <CardMedia src={hotel.coverImage} />
                    <CardContent className="space-y-2 pt-4">
                      <h2 className="line-clamp-2 text-base leading-tight font-semibold tracking-tight">
                        {hotel.name}
                      </h2>
                      {hotel.address ? (
                        <p className="line-clamp-1 text-sm text-[var(--text-secondary)]">
                          {hotel.address}
                        </p>
                      ) : null}
                      {typeof hotel.starRating === 'number' ? (
                        <p
                          className="text-sm text-[var(--color-warning-600)]"
                          aria-label={catalog('filters.starsValue', { count: hotel.starRating })}
                        >
                          {'★'.repeat(hotel.starRating)}
                        </p>
                      ) : null}
                      {typeof hotel.priceFromUsd === 'number' ? (
                        <p className="text-sm">
                          <span className="text-[var(--text-tertiary)]">{t('card.from')} </span>
                          <Price
                            amountUsd={hotel.priceFromUsd}
                            className="font-semibold text-[var(--text-primary)]"
                            suffix={t('card.perNight')}
                          />
                        </p>
                      ) : null}
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
