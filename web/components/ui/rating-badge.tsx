'use client'

import { Star } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/cn'

export interface RatingBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  rating: number | string
  reviewsCount?: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'frosted' | 'solid' | 'sand'
}

/**
 * NAVEL UI Kit Rating Badge (`Item/Rating/Big` and `Item/Rating/Small`).
 * Displays a gold star and rounded numeric rating with frosted backdrop.
 */
export function RatingBadge({
  rating,
  reviewsCount,
  size = 'md',
  variant = 'frosted',
  className,
  ...props
}: RatingBadgeProps) {
  const formattedRating =
    typeof rating === 'number' ? (Number.isInteger(rating) ? `${rating}.0` : rating.toFixed(1)) : rating

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 font-semibold select-none rounded-full backdrop-blur-md transition-all',
        // Variants
        variant === 'frosted' &&
          'bg-black/35 text-white shadow-sm ring-1 ring-white/15 dark:bg-black/50',
        variant === 'solid' &&
          'bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-xs',
        variant === 'sand' &&
          'bg-[#F5EADD] text-[#1B3232] dark:bg-[#1E2C2C] dark:text-[#F5EADD]',
        // Sizes
        size === 'sm' && 'h-6 px-2 text-xs',
        size === 'md' && 'h-8 px-3 text-xs',
        size === 'lg' && 'h-9 px-3.5 text-sm',
        className,
      )}
      {...props}
    >
      <Star
        aria-hidden="true"
        className={cn(
          'fill-[#E7B171] text-[#E7B171] shrink-0',
          size === 'sm' && 'size-3',
          size === 'md' && 'size-3.5',
          size === 'lg' && 'size-4',
        )}
      />
      <span>{formattedRating}</span>
      {reviewsCount !== undefined && (
        <span className="opacity-75 font-normal">({reviewsCount})</span>
      )}
    </div>
  )
}
