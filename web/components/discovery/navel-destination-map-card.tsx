'use client'

import { ArrowRight, Bookmark, MapPin, Star } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/cn'
import { getNavelImage } from '@/lib/navel-assets'

export interface DestinationMapCardProps {
  id: string
  name: string
  category?: string | null
  coverImage?: string | null
  entryFeeUsd?: number | null
  ratingAverage?: number | null
  location?: string | null
  isSelected?: boolean
  onSelect?: () => void
  onOpenDetails?: () => void
}

/**
 * NAVEL `Card/Destination-Active` (265x135)
 * Horizontal compact destination card rendered in the map carousel.
 */
export function NavelDestinationMapCard({
  id,
  name,
  category,
  coverImage,
  entryFeeUsd,
  ratingAverage,
  location,
  isSelected,
  onSelect,
  onOpenDetails,
}: DestinationMapCardProps) {
  const [bookmarked, setBookmarked] = React.useState(false)

  const imgSrc = getNavelImage(coverImage, id)

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group relative h-[135px] w-[265px] shrink-0 cursor-pointer overflow-hidden rounded-[23px] transition-all duration-300 select-none snap-start',
        isSelected
          ? 'border-2 border-[var(--color-navel-jade)] ring-4 ring-[var(--color-navel-jade)]/25 shadow-lg scale-[1.02]'
          : 'border-2 border-transparent hover:border-white/40 opacity-95 hover:opacity-100',
      )}
    >
      {/* Background Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc}
        alt={name}
        className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* Dark Forest Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#1B3232]/95 via-[#1B3232]/40 to-black/20" />

      {/* Card Content Overlay */}
      <div className="relative flex h-full flex-col justify-between p-3">
        {/* Top bar: Category badge + Bookmark */}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
            {category || 'Recommended'}
          </span>

          <button
            type="button"
            aria-label="Save destination"
            onClick={(e) => {
              e.stopPropagation()
              setBookmarked(!bookmarked)
            }}
            className="flex size-7 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-md transition-colors hover:bg-black/40"
          >
            <Bookmark
              className={cn('size-3.5', bookmarked && 'fill-[var(--color-navel-gold)] text-[var(--color-navel-gold)]')}
            />
          </button>
        </div>

        {/* Bottom bar: Info & Next button */}
        <div className="space-y-1">
          <h3 className="font-dela line-clamp-1 text-sm font-bold tracking-tight text-white drop-shadow-sm">
            {name}
          </h3>

          {location ? (
            <div className="flex items-center gap-1 text-[10px] text-white/80">
              <MapPin className="size-2.5 text-[var(--color-navel-gold)] shrink-0" />
              <span className="truncate">{location}</span>
            </div>
          ) : null}

          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-1.5">
              {/* Rating badge */}
              <div className="inline-flex items-center gap-0.5 rounded-md bg-[var(--color-navel-gold)]/90 px-1.5 py-0.5 text-[10px] font-bold text-[#1B3232]">
                <Star className="size-2.5 fill-current" />
                <span>{ratingAverage ? ratingAverage.toFixed(1) : '4.8'}</span>
              </div>

              {/* Price or fee */}
              <span className="rounded-md bg-[#415F5F]/80 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                {entryFeeUsd === 0 || entryFeeUsd == null ? 'Free' : `$${entryFeeUsd}`}
              </span>
            </div>

            {/* Action arrow button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (onOpenDetails) onOpenDetails()
                else if (onSelect) onSelect()
              }}
              aria-label={`View details for ${name}`}
              className="flex size-7 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-md transition-all hover:bg-white hover:text-[#1B3232]"
            >
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
