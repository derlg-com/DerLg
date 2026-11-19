'use client'

import { ArrowRight, Search as SearchIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Price } from '@/components/shared/price'
import {
  Card,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from '@/components/ui'
import { useSearch } from '@/hooks/use-catalog'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/i18n/navigation'

/** Detail route per result kind; unknown kinds are rendered without a link. */
const ROUTE_BY_KIND: Record<string, string> = {
  trip: '/trips',
  hotel: '/hotels',
  guide: '/guides',
  transport: '/transport',
  place: '/places',
}

const LABELLED_KINDS = new Set(['trip', 'hotel', 'guide', 'place'])

export function SearchResults({ term }: { term: string }) {
  const t = useTranslations('search')
  const common = useTranslations('common')
  const [selectedKind, setSelectedKind] = React.useState<string>('all')

  const { data, isPending, isError, refetch, isFetching } = useSearch(term, { limit: 24 })

  const trimmed = term.trim()

  if (trimmed.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-[var(--color-navel-cream)] dark:bg-[var(--surface-sunken)] text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)] mb-4 shadow-sm">
          <SearchIcon className="size-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
          {t('promptTitle')}
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-xs">
          {t('promptDesc')}
        </p>
      </div>
    )
  }

  if (isPending || (isFetching && !data)) {
    return (
      <LoadingRegion label={common('loading')}>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48 rounded-full" />
          <ul className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index}>
                <div className="h-44 w-full rounded-[24px] bg-[var(--surface-sunken)] animate-pulse" />
              </li>
            ))}
          </ul>
        </div>
      </LoadingRegion>
    )
  }

  if (isError) {
    return (
      <ErrorState
        title={t('errorTitle')}
        description={t('errorDesc')}
        onRetry={() => void refetch()}
        retryLabel={common('tryAgain')}
      />
    )
  }

  const allItems = data?.items ?? []
  const filteredItems =
    selectedKind === 'all'
      ? allItems
      : allItems.filter((item) => item.kind === selectedKind)

  if (!data || allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-[var(--color-navel-cream)]/70 dark:bg-[var(--surface-sunken)] text-[var(--text-tertiary)] mb-4">
          <SearchIcon className="size-9 opacity-50" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
          {t('noResults', { query: trimmed })}
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-xs">
          {t('noResultsDesc')}
        </p>
      </div>
    )
  }

  const KINDS = ['all', 'trip', 'place', 'hotel', 'guide']

  return (
    <div className="space-y-4">
      {/* Title & Total count matching NAVEL "Found 90+ Destination" */}
      <div className="flex items-center justify-between">
        <h2 className="font-dela text-lg sm:text-xl font-bold tracking-tight text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
          Found {filteredItems.length} {filteredItems.length === 1 ? 'Destination' : 'Destinations'}
        </h2>
        <span className="text-xs font-semibold text-[var(--color-navel-jade)]">
          &ldquo;{trimmed}&rdquo;
        </span>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {KINDS.map((k) => {
          const isActive = selectedKind === k
          const label = t(`tabs.${k}` as 'tabs.all')
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSelectedKind(k)}
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all shadow-sm',
                isActive
                  ? 'bg-[var(--color-navel-forest)] text-[var(--color-navel-mint)] dark:bg-[var(--color-navel-mint)] dark:text-[var(--color-navel-forest)]'
                  : 'bg-[var(--color-navel-cream)]/70 dark:bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--color-navel-cream)]',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Results List */}
      <ul className="grid gap-3 sm:grid-cols-2">
        {filteredItems.map((result) => {
          const base = ROUTE_BY_KIND[result.kind]
          const imgSrc =
            result.image ||
            'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80'

          const cardContent = (
            <div className="group flex h-full items-center gap-3.5 p-3">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-[20px] shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc}
                  alt={result.title}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="rounded-md bg-[var(--color-navel-cream)]/90 dark:bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)] uppercase tracking-wider">
                      {LABELLED_KINDS.has(result.kind)
                        ? t(`tabs.${result.kind}` as 'tabs.trip')
                        : result.kind}
                    </span>
                  </div>
                  <h3 className="line-clamp-2 text-sm font-bold leading-snug tracking-tight text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)]">
                    {result.title}
                  </h3>
                </div>

                <div className="flex items-center justify-between pt-2 mt-auto">
                  {typeof result.basePriceUsd === 'number' ? (
                    <span className="text-sm font-extrabold text-[var(--color-navel-forest)] dark:text-[var(--color-navel-gold)]">
                      <Price amountUsd={result.basePriceUsd} />
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-[var(--color-navel-jade)]">
                      Explore
                    </span>
                  )}

                  <div className="flex size-7 items-center justify-center rounded-full bg-[var(--color-navel-cream)] dark:bg-[var(--surface-sunken)] text-[var(--color-navel-forest)] dark:text-[var(--color-navel-mint)] transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="size-3.5" />
                  </div>
                </div>
              </div>
            </div>
          )

          return (
            <li key={`${result.kind}-${result.id}`}>
              <Card
                interactive
                as="article"
                className="overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface)] dark:bg-[var(--surface-sunken)] shadow-sm transition-all hover:shadow-md"
              >
                {base ? (
                  <Link
                    href={`${base}/${result.id}`}
                    className="block h-full focus-visible:outline-none"
                  >
                    {cardContent}
                  </Link>
                ) : (
                  cardContent
                )}
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
