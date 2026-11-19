'use client'

import { ArrowRight, Bookmark, MapPin } from 'lucide-react'
import Image from 'next/image'
import * as React from 'react'

import { RatingBadge } from '@/components/ui/rating-badge'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/i18n/navigation'
import { getNavelImage } from '@/lib/navel-assets'
import type { TripSummary } from '@/schemas/domain'

export interface NavelDestinationCardProps {
  trip: TripSummary
  priority?: boolean
  className?: string
  badgeLabel?: string
}

/**
 * NAVEL UI Kit Signature `Card/Destination/Tall` (265x534).
 * Full-bleed destination photography with frosted badges, rating star,
 * and circular translucent navigation arrow.
 */
export function NavelDestinationCard({
  trip,
  priority = false,
  className,
  badgeLabel = 'Recommended',
}: NavelDestinationCardProps) {
  const [isSaved, setIsSaved] = React.useState(false)

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsSaved((prev) => !prev)
  }

  const destinationLocation = trip.location || 'Cambodia'
  const imageUrl = getNavelImage(trip.coverImageUrl, trip.id)

  return (
    <article
      className={cn(
        'group relative w-[265px] h-[480px] sm:h-[520px] shrink-0 rounded-[28px] overflow-hidden select-none',
        'shadow-[0_16px_36px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_16px_36px_-12px_rgba(0,0,0,0.6)]',
        'border border-black/5 dark:border-white/10 transition-all duration-300 hover:scale-[1.01]',
        className,
      )}
    >
      {/* Background Image */}
      <Image
        src={imageUrl}
        alt={trip.name}
        fill
        priority={priority}
        sizes="265px"
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />

      {/* Cinematic Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 pointer-events-none" />

      {/* Top Bar: Recommended Tag + Bookmark Toggle */}
      <div className="absolute top-4 inset-x-4 flex items-center justify-between z-10">
        <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/20 hover:bg-white/25 backdrop-blur-md text-white border border-white/15 tracking-wide shadow-xs">
          {badgeLabel}
        </span>

        <button
          type="button"
          onClick={handleBookmark}
          aria-label={isSaved ? 'Remove from bookmarks' : 'Save to bookmarks'}
          className={cn(
            'size-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-200 active:scale-90',
            isSaved
              ? 'bg-[#E7B171] text-[#1B3232] shadow-sm'
              : 'bg-black/30 text-white hover:bg-black/45 border border-white/15',
          )}
        >
          <Bookmark
            aria-hidden="true"
            className={cn('size-4 transition-all', isSaved && 'fill-current stroke-[2.5px]')}
          />
        </button>
      </div>

      {/* Bottom Content Area */}
      <div className="absolute bottom-0 inset-x-0 p-5 z-10 flex flex-col justify-end space-y-3">
        {/* Title */}
        <h3 className="font-dela text-xl sm:text-2xl font-bold text-white leading-tight drop-shadow-sm line-clamp-2">
          {trip.name}
        </h3>

        {/* Location with Pin */}
        <div className="flex items-center gap-1.5 text-white/85 text-xs font-medium">
          <MapPin aria-hidden="true" className="size-3.5 text-[#E7B171] shrink-0" />
          <span className="truncate">{destinationLocation}</span>
        </div>

        {/* Footer: Rating Badge + Next Arrow Button */}
        <div className="flex items-center justify-between pt-1">
          <RatingBadge
            rating={trip.ratingAverage ?? 4.9}
            reviewsCount={trip.ratingCount ?? undefined}
            variant="frosted"
            size="md"
          />

          <Link
            href={`/trips/${trip.id}`}
            aria-label={`View details for ${trip.name}`}
            className="size-12 rounded-full bg-white/25 hover:bg-white/40 active:scale-95 text-white backdrop-blur-md flex items-center justify-center border border-white/20 transition-all duration-200 shadow-sm"
          >
            <ArrowRight aria-hidden="true" className="size-5 stroke-[2.5px]" />
          </Link>
        </div>
      </div>
    </article>
  )
}
