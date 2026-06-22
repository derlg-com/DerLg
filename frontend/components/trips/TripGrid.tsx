'use client'

import { Compass } from 'lucide-react'
import { TripCard } from './TripCard'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/lib/i18n'
import type { TripSummary } from '@/types/catalog'

interface TripGridProps {
  trips: TripSummary[]
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  onClearFilters?: () => void
}

export function TripGrid({ trips, isLoading, isError, onRetry, onClearFilters }: TripGridProps) {
  const t = useTranslations('trips')

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

  if (trips.length === 0) {
    return (
      <EmptyState
        icon={Compass}
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
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  )
}
