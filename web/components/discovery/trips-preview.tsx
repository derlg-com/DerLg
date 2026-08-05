'use client'

import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'

import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from '@/components/ui'
import { useTrips } from '@/hooks/use-catalog'
import { ApiError } from '@/lib/api/errors'
import { formatPrice, formatRating } from '@/lib/format'
import { localeTags, type Locale } from '@/lib/i18n/config'
import { Link } from '@/lib/i18n/navigation'

/**
 * Live trip list, proving the data layer end to end against the backend.
 *
 * Superseded by the full browse experience in Task 7; kept minimal here so the
 * loading, empty and error paths are all visible and testable.
 */
export function TripsPreview() {
  const locale = useLocale() as Locale
  const t = useTranslations('trips')
  const common = useTranslations('common')
  const { data, isPending, isError, error, refetch } = useTrips({ limit: 12 })

  if (isPending) {
    return (
      <LoadingRegion label={common('loading')}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index}>
              <Card className="overflow-hidden">
                {/* Fixed aspect box so the skeleton occupies the loaded card's space. */}
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
    const apiError = error instanceof ApiError ? error : null
    return (
      <ErrorState
        title={t('error.title')}
        // Never show a raw error string: a transport failure and a rejected
        // request need different guidance.
        description={apiError?.isRetryable ? t('error.desc') : t('error.desc')}
        onRetry={() => void refetch()}
        retryLabel={t('error.retry')}
      />
    )
  }

  if (data.items.length === 0) {
    return <EmptyState title={t('empty.title')} description={t('empty.desc')} />
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        {t('list.resultsCount', { count: data.total })}
      </p>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((trip) => {
          const rating = formatRating(trip.ratingAverage, localeTags[locale])
          return (
            <li key={trip.id}>
              <Card interactive as="article" className="h-full overflow-hidden">
                <Link href={`/trips/${trip.id}`} className="block focus-visible:outline-none">
                  <div className="relative aspect-[4/3] w-full bg-[var(--surface-sunken)]">
                    {trip.coverImageUrl ? (
                      <Image
                        src={trip.coverImageUrl}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <CardContent className="space-y-2 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base leading-tight font-semibold tracking-tight">
                        {trip.name}
                      </h3>
                      {trip.category ? <Badge tone="neutral">{trip.category}</Badge> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--text-secondary)]">
                      <span>
                        {trip.durationDays} {t('card.days')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-[var(--text-primary)]">
                        {formatPrice(trip.priceUsd, 'USD', localeTags[locale])}
                      </span>
                      <span className="text-[var(--text-tertiary)]">{t('card.perPerson')}</span>
                      {rating ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>★ {rating}</span>
                        </>
                      ) : null}
                    </div>
                  </CardContent>
                </Link>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
