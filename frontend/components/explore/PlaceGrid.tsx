'use client'

import { MapPin } from 'lucide-react'
import { PlaceCard } from './PlaceCard'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/lib/i18n'
import type { PlaceSummary } from '@/types/domain'

interface PlaceGridProps {
  places: PlaceSummary[]
  isLoading?: boolean
  isError?: boolean
  /** Build the per-card href (e.g. to open the detail modal via `?place=`). */
  hrefFor?: (place: PlaceSummary) => string
  onRetry?: () => void
  onClearFilters?: () => void
}

/**
 * Responsive grid of {@link PlaceCard}s for the Explore → Places tab, with
 * loading skeletons, an error state (retry), and an empty state (clear filters)
 * — mirroring {@link TripGrid} so the two catalogs feel identical.
 */
export function PlaceGrid({
  places,
  isLoading,
  isError,
  hrefFor,
  onRetry,
  onClearFilters,
}: PlaceGridProps) {
  const t = useTranslations('explore.places')

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[4/3] w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        title={t('error.title')}
        description={t('error.desc')}
        action={
          onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              {t('error.retry')}
            </Button>
          ) : undefined
        }
      />
    )
  }

  if (places.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title={t('empty.title')}
        description={t('empty.desc')}
        action={
          onClearFilters ? (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              {t('empty.clear')}
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {places.map((place) => (
        <PlaceCard key={place.id} place={place} href={hrefFor?.(place)} />
      ))}
    </div>
  )
}
