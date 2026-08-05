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
import { useGuides } from '@/hooks/use-catalog'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { Link } from '@/lib/i18n/navigation'

const DEFAULTS = {
  language: undefined as string | undefined,
  specialty: undefined as string | undefined,
  page: undefined as string | undefined,
}

/**
 * P2: the backend widened SupportedLanguage beyond the UI locales, so the
 * filter offers the full set rather than reusing `locales` (en/zh/km).
 */
export const GUIDE_LANGUAGES = ['en', 'zh', 'km', 'ja', 'ko', 'fr', 'de', 'es', 'th', 'vi'] as const

/** P2: enum-backed specialties from the backend Specialty enum. */
export const GUIDE_SPECIALTIES = [
  'culture_history',
  'food_tours',
  'nature_trekking',
  'photography',
  'family_friendly',
  'business',
  'luxury',
  'adventure',
] as const

/** culture_history -> Culture history. */
function readableSpecialty(value: string): string {
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Full language name from `catalog.filters.languageNames`, falling back to the
 * uppercased code for codes the messages do not know yet.
 */
function languageLabel(code: string, t: ReturnType<typeof useTranslations<'catalog'>>): string {
  const key = `filters.languageNames.${code}` as never
  return t.has(key) ? t(key) : code.toUpperCase()
}

/**
 * P2: prefer the new enum-backed `specialties` field; fall back to the legacy
 * free-text `specialities` until the backend ships the rename.
 */
function specialtiesOf(guide: {
  specialties?: string[] | null
  specialities?: string[] | null
}): string[] {
  return guide.specialties && guide.specialties.length > 0
    ? guide.specialties
    : guide.specialities ?? []
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
    language: filters.language,
    specialty: filters.specialty,
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
              {GUIDE_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {languageLabel(code, catalog)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={catalog('filters.specialty')} className="min-w-48">
          {(props) => (
            <Select
              {...props}
              value={filters.specialty ?? ''}
              onChange={(event) => setFilters({ specialty: event.target.value || undefined })}
            >
              <option value="">{catalog('filters.anySpecialty')}</option>
              {GUIDE_SPECIALTIES.map((specialty) => (
                <option key={specialty} value={specialty}>
                  {readableSpecialty(specialty)}
                </option>
              ))}
            </Select>
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
                        {/*
                         * P2: languages + specialties are the guide's PRIMARY
                         * identity, so they lead the card. The API provides no
                         * guide name, so the heading is the language set.
                         */}
                        <h2
                          className="line-clamp-2 text-base leading-tight font-semibold tracking-tight"
                          aria-label={
                            guide.languages && guide.languages.length > 0
                              ? guide.languages.map((code) => languageLabel(code, catalog)).join(' · ')
                              : undefined
                          }
                        >
                          {guide.languages && guide.languages.length > 0
                            ? guide.languages
                                .map((code) => languageLabel(code, catalog))
                                .join(' · ')
                            : guide.province ?? t('card.verified')}
                        </h2>
                        {guide.isVerified ? (
                          <Badge tone="success" className="shrink-0">
                            {t('card.verified')}
                          </Badge>
                        ) : null}
                      </div>

                      {specialtiesOf(guide).length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5" aria-label={catalog('detail.specialities')}>
                          {specialtiesOf(guide).map((specialty) => (
                            <li key={specialty}>
                              <Badge tone="neutral">{readableSpecialty(specialty)}</Badge>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {guide.province ? (
                        <p className="line-clamp-1 text-sm text-[var(--text-tertiary)]">
                          {guide.province}
                          {guide.provinces && guide.provinces.length > 1
                            ? ` · ${guide.provinces.length} areas`
                            : ''}
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
