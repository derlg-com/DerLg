'use client'

import { CalendarDays } from 'lucide-react'
import { FestivalCard } from '@/components/festivals/FestivalCard'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/lib/i18n'
import type { FestivalSummary } from '@/types/domain'

interface FestivalGridProps {
  festivals: FestivalSummary[]
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  onClearFilters?: () => void
}

/**
 * Responsive grid of {@link FestivalCard}s for the Explore → Festivals tab, with
 * loading skeletons, an error state (retry), and an empty state (clear filters)
 * — mirroring {@link PlaceGrid} so the two catalogs feel identical. Festival
 * cards link to `/festivals/<id>` (the detail route built in task 7.3).
 */
export function FestivalGrid({
  festivals,
  isLoading,
  isError,
  onRetry,
  onClearFilters,
}: FestivalGridProps) {
  const t = useTranslations('explore.festivals')

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

  if (festivals.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
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
      {festivals.map((festival) => (
        <FestivalCard key={festival.id} festival={festival} />
      ))}
    </div>
  )
}
