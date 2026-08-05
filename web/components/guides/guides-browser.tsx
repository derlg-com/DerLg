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
  Input,
  LoadingRegion,
  Select,
  Skeleton,
} from '@/components/ui'
import { useGuides } from '@/hooks/use-catalog'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { Link } from '@/lib/i18n/navigation'
import { locales } from '@/lib/i18n/config'

const DEFAULTS = {
  language: undefined as string | undefined,
  speciality: undefined as string | undefined,
  page: undefined as string | undefined,
}

const PAGE_SIZE = 12

export function GuidesBrowser() {
  const t = useTranslations('guides')
  const catalog = useTranslations('catalog')
  const common = useTranslations('common')
  const search = useTranslations('search')

  const { filters, setFilters, clearFilters, activeCount } = useUrlFilters(DEFAULTS)
  const page = Number(filters.page ?? '1')

  const { data, isPending, isError, refetch } = useGuides({
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: PAGE_SIZE,
    // The backend validates language against its own en|zh|km enum.
    language: filters.language,
    speciality: filters.speciality,
  })

  return (
    <div className="space-y-6">
      <FilterBar activeCount={activeCount} onClear={clearFilters}>
        <Field label={catalog('filters.language')} className="min-w-44">
          {(props) => (
            <Select
              {...props}
              value={filters.language ?? ''}
              onChange={(event) => setFilters({ language: event.target.value || undefined })}
            >
              <option value="">{catalog('filters.anyLanguage')}</option>
              {locales.map((code) => (
                <option key={code} value={code}>
                  {code.toUpperCase()}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={catalog('detail.specialities')} className="min-w-48">
          {(props) => (
            <Input
              {...props}
              type="search"
              defaultValue={filters.speciality ?? ''}
              onChange={(event) => {
                const value = event.target.value.trim()
                setFilters({ speciality: value === '' ? undefined : value })
              }}
            />
          )}
        </Field>
      </FilterBar>

      {isPending ? (
        <LoadingRegion label={common('loading')}>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <li key={index}>
                <Card className="overflow-hidden">
                  <Skeleton className="aspect-square w-full rounded-none" />
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
                href="/guides"
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

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.items.map((guide) => (
              <li key={guide.id}>
                <Card interactive as="article" className="h-full overflow-hidden">
                  <Link
                    href={`/guides/${guide.id}`}
                    className="block h-full focus-visible:outline-none"
                  >
                    <CardMedia src={guide.avatarUrl} ratio="1/1" sizes="(min-width: 1024px) 25vw, 50vw" />
                    <CardContent className="space-y-2 pt-4">
                      <div className="flex items-start justify-between gap-2">
                        {/* The API provides no guide name, so the province is the heading. */}
                        <h2 className="line-clamp-1 text-base leading-tight font-semibold tracking-tight">
                          {guide.province ?? t('card.verified')}
                        </h2>
                        {guide.isVerified ? (
                          <Badge tone="success">{t('card.verified')}</Badge>
                        ) : null}
                      </div>

                      {guide.languages && guide.languages.length > 0 ? (
                        <p className="text-sm text-[var(--text-secondary)]">
                          {guide.languages.map((code) => code.toUpperCase()).join(' · ')}
                        </p>
                      ) : null}

                      {guide.specialities && guide.specialities.length > 0 ? (
                        <p className="line-clamp-2 text-sm text-[var(--text-tertiary)]">
                          {guide.specialities.join(', ')}
                        </p>
                      ) : null}

                      <p className="text-sm">
                        <Price
                          amountUsd={guide.pricePerDayUsd}
                          className="font-semibold text-[var(--text-primary)]"
                          suffix={t('card.perDay')}
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
