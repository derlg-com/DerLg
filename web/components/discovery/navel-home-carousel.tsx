'use client'

import * as React from 'react'

import { NavelCategoryTabs } from '@/components/discovery/navel-category-tabs'
import { NavelDestinationCard } from '@/components/discovery/navel-destination-card'
import type { TripSummary } from '@/schemas/domain'

export interface NavelHomeCarouselProps {
  trips: TripSummary[]
  title?: string
  viewAllHref?: string
}

export function NavelHomeCarousel({
  trips,
  title = 'Recommendation',
}: NavelHomeCarouselProps) {
  const [activeCategory, setActiveCategory] = React.useState('recommendation')

  const filteredTrips = React.useMemo(() => {
    if (activeCategory === 'recommendation' || activeCategory === 'popular') {
      return trips
    }
    return trips.filter(
      (t) => t.category?.toLowerCase() === activeCategory.toLowerCase(),
    )
  }, [trips, activeCategory])

  const displayList = filteredTrips.length > 0 ? filteredTrips : trips

  return (
    <section className="space-y-4 pt-2">
      {/* Category Tabs */}
      <NavelCategoryTabs activeId={activeCategory} onChange={setActiveCategory} />

      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="font-dela text-xl sm:text-2xl font-bold tracking-tight text-[#1B3232] dark:text-white">
          {title}
        </h2>
        <span className="text-xs font-semibold text-[var(--text-secondary)] dark:text-[#A1B0B0]">
          {displayList.length} destinations
        </span>
      </div>

      {/* Horizontal Snap Scroll Carousel */}
      <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scroll-smooth no-scrollbar">
          {displayList.map((trip, idx) => (
            <div key={trip.id} className="snap-start shrink-0">
              <NavelDestinationCard
                trip={trip}
                priority={idx === 0}
                badgeLabel={idx === 0 ? 'Top Pick' : 'Recommended'}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
