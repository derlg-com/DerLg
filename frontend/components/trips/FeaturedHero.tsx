'use client'

import { TripCard } from './TripCard'
import { Skeleton } from '@/components/ui/skeleton'
import type { TripSummary } from '@/types/catalog'

interface FeaturedHeroProps {
  trips: TripSummary[]
  isLoading?: boolean
}

export function FeaturedHero({ trips, isLoading }: FeaturedHeroProps) {
  if (isLoading) {
    return (
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-64 shrink-0 space-y-2">
            <Skeleton className="aspect-[4/3] w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  if (trips.length === 0) return null

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
      {trips.map((trip) => (
        <div key={trip.id} className="w-64 shrink-0 snap-start">
          <TripCard trip={trip} />
        </div>
      ))}
    </div>
  )
}
