'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface StarRatingInputProps {
  /** Current selected rating (0 = none). */
  value: number
  onChange: (value: number) => void
  /** Accessible group label. */
  label: string
  /** Per-star label builder, e.g. `(n) => \`${n} stars\``. */
  starLabel: (n: number) => string
  disabled?: boolean
  className?: string
}

const STARS = [1, 2, 3, 4, 5] as const

/**
 * Interactive 1–5 star selector for the review form (Requirement 21.3).
 * Implemented as an accessible radiogroup of buttons with keyboard support and
 * hover preview. Each star is a real `<button>` exposing a localized label so
 * assistive tech announces "N stars".
 */
export function StarRatingInput({
  value,
  onChange,
  label,
  starLabel,
  disabled = false,
  className,
}: StarRatingInputProps) {
  const [hover, setHover] = useState<number>(0)
  const active = hover || value

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex items-center gap-1', className)}
    >
      {STARS.map((n) => {
        const filled = n <= active
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={starLabel(n)}
            disabled={disabled}
            onClick={() => onChange(n)}
            onMouseEnter={() => !disabled && setHover(n)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => !disabled && setHover(n)}
            onBlur={() => setHover(0)}
            className={cn(
              'rounded-md p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
            )}
          >
            <Star
              className={cn(
                'h-7 w-7',
                filled ? 'fill-rating text-rating' : 'fill-transparent text-muted-foreground',
              )}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
}
