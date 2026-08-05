'use client'

import { useLocale, useTranslations } from 'next-intl'

import { FilterBar } from '@/components/shared/filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { CardMedia } from '@/components/shared/card-media'
import { Price } from '@/components/shared/price'
import { Rating } from '@/components/shared/rating'
import {
  Badge,
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
import { useTrips } from '@/hooks/use-catalog'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { localeTags, type Locale } from '@/lib/i18n/config'
import { Link } from '@/lib/i18n/navigation'
import { TRIP_CATEGORIES } from '@/schemas/domain'

/** Category enum values mapped to their capitalised message keys. */
const CATEGORY_KEYS: Record<string, string> = {
  temples: 'Temples',
  nature: 'Nature',
  culture: 'Culture',
  adventure: 'Adventure',
  food: 'Food',
}

const DEFAULTS = {
  category: undefined as string | undefined,
  priceMin: undefined as string | undefined,
  priceMax: undefined as string | undefined,
  durationDays: undefined as string | undefined,
  page: undefined as string | undefined,
}

const PAGE_SIZE = 12

export function TripsBrowser() {
  const locale = useLocale() as Locale
  const t = useTranslations('trips')
  const catalog = useTranslations('catalog')
  const common = useTranslations('common')

  const { filters, setFilters, clearFilters, activeCount } = useUrlFilters(DEFAULTS)

  const page = Number(filters.page ?? '1')

  const { data, isPending, isError, refetch, isPlaceholderData } = useTrips({
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: PAGE_SIZE,
    // Only pass values the backend DTO declares; undefined entries are dropped.
    category: filters.category,
    priceMin: filters.priceMin ? Number(filters.priceMin) : undefined,
    priceMax: filters.priceMax ? Number(filters.priceMax) : undefined,
    durationDays: filters.durationDays ? Number(filters.durationDays) : undefined,
  })

  const controls = (
    <>
      <Field label={catalog('filters.category')} className="min-w-40">
        {(props) => (
          <Select
            {...props}
            value={filters.category ?? ''}
            onChange={(event) => setFilters({ category: event.target.value || undefined })}
          >
            <option value="">{t('categories.all')}</option>
            {TRIP_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`categories.${CATEGORY_KEYS[category]}` as 'categories.Temples')}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label={catalog('filters.priceMin')} className="w-28">
        {(props) => (
          <Input
            {...props}
            type="number"
            min={0}
            inputMode="numeric"
            value={filters.priceMin ?? ''}
            onChange={(event) => setFilters({ priceMin: event.target.value || undefined })}
          />
        )}
      </Field>

      <Field label={catalog('filters.priceMax')} className="w-28">
        {(props) => (
          <Input
            {...props}
            type="number"
            min={0}
            inputMode="numeric"
            value={filters.priceMax ?? ''}
            onChange={(event) => setFilters({ priceMax: event.target.value || undefined })}
          />
        )}
      </Field>

      <Field label={catalog('filters.duration')} className="min-w-36">
        {(props) => (
          <Select
            {...props}
            value={filters.durationDays ?? ''}
            onChange={(event) => setFilters({ durationDays: event.target.value || undefined })}
          >
            <option value="">{catalog('filters.anyDuration')}</option>
            {[1, 2, 3, 4, 5, 7, 10].map((days) => (
              <option key={days} value={days}>
                {days} {t('card.days')}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </>
  )

  /*
   * There is deliberately no sort control here. Every backend list use-case
   * hardcodes `orderBy: { createdAt: 'desc' }` and ignores the `sort` query
   * parameter it accepts, so a sort dropdown would look functional while doing
   * nothing — worse than offering no control at all. Reinstate this once the
   * backend implements sorting.
   */
  return (
    <div className="space-y-6">
      <FilterBar activeCount={activeCount} onClear={clearFilters}>
        {controls}
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
          title={t('error.title')}
          description={t('error.desc')}
          onRetry={() => void refetch()}
          retryLabel={t('error.retry')}
        />
      ) : data.items.length === 0 ? (
        <EmptyState
          title={t('empty.title')}
          description={t('empty.desc')}
          action={
            activeCount > 0 ? (
              // A real link rather than a callback: it survives reload, opens in a
              // new tab, and works before JavaScript has loaded.
              <Link
                href="/trips"
                className="inline-flex min-h-9 items-center rounded-md border border-[var(--border-default)] px-3 text-sm font-medium hover:bg-[var(--surface-hover)] pointer-coarse:min-h-11"
              >
                {t('empty.clear')}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
            {t('list.resultsCount', { count: data.total })}
          </p>

          <ul
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            // Dim while a new page loads so it is clear the list is updating.
            style={{ opacity: isPlaceholderData ? 0.6 : 1 }}
          >
            {data.items.map((trip) => (
              <li key={trip.id}>
                <Card interactive as="article" className="h-full overflow-hidden">
                  <Link href={`/trips/${trip.id}`} className="block h-full focus-visible:outline-none">
                    <CardMedia src={trip.coverImageUrl}>
                      {trip.category ? (
                        <span className="absolute top-2 left-2">
                          <Badge tone="neutral" className="bg-[var(--surface)]/90 backdrop-blur">
                            {trip.category}
                          </Badge>
                        </span>
                      ) : null}
                    </CardMedia>
                    <CardContent className="space-y-2 pt-4">
                      <h2 className="line-clamp-2 text-base leading-tight font-semibold tracking-tight">
                        {trip.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--text-secondary)]">
                        <span>
                          {trip.durationDays} {t('card.days')}
                        </span>
                        <Rating
                          average={trip.ratingAverage}
                          count={trip.ratingCount}
                          locale={localeTags[locale]}
                        />
                      </div>
                      <p className="text-sm">
                        <Price
                          amountUsd={trip.priceUsd}
                          className="font-semibold text-[var(--text-primary)]"
                          suffix={t('card.perPerson')}
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
