'use client'

import { useTranslations } from 'next-intl'

import { CardMedia } from '@/components/shared/card-media'
import { Price } from '@/components/shared/price'
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from '@/components/ui'
import { useSearch } from '@/hooks/use-catalog'
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
  const { data, isPending, isError, refetch, isFetching } = useSearch(term, { limit: 24 })

  const trimmed = term.trim()

  if (trimmed.length < 2) {
    return (
      <EmptyState title={t('promptTitle')} description={t('promptDesc')} />
    )
  }

  if (isPending || (isFetching && !data)) {
    return (
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

  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        title={t('noResults', { query: trimmed })}
        description={t('noResultsDesc')}
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
        {data.total} · {trimmed}
      </p>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((result) => {
          const base = ROUTE_BY_KIND[result.kind]
          const body = (
            <>
              {/* Search results use `image` and `title`, unlike the catalogue lists. */}
              <CardMedia src={result.image} />
              <CardContent className="space-y-2 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="line-clamp-2 text-base leading-tight font-semibold tracking-tight">
                    {result.title}
                  </h2>
                  <Badge tone="neutral">
                    {LABELLED_KINDS.has(result.kind)
                      ? t(`tabs.${result.kind}` as 'tabs.trip')
                      : result.kind}
                  </Badge>
                </div>
                {typeof result.basePriceUsd === 'number' ? (
                  <p className="text-sm">
                    <Price
                      amountUsd={result.basePriceUsd}
                      className="font-semibold text-[var(--text-primary)]"
                    />
                  </p>
                ) : null}
              </CardContent>
            </>
          )

          return (
            <li key={`${result.kind}-${result.id}`}>
              <Card interactive as="article" className="h-full overflow-hidden">
                {base ? (
                  <Link
                    href={`${base}/${result.id}`}
                    className="block h-full focus-visible:outline-none"
                  >
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
