'use client'

import { cn } from '@/lib/utils'

export interface RatingBubblesProps {
  /** Score from 0–5. */
  rating: number
  /** Optional review count, rendered as "(count)". */
  count?: number
  size?: 'sm' | 'md'
  className?: string
}

const BUBBLE_PX = { sm: 12, md: 16 } as const
const GAP_PX = 4 // matches gap-1

/** A row of five bubbles, either filled (score) or empty (track). */
function BubbleRow({ filled, px }: { filled: boolean; px: number }) {
  return (
    <span className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'shrink-0 rounded-full',
            filled ? 'bg-rating' : 'bg-muted ring-1 ring-rating/25',
          )}
          style={{ width: px, height: px }}
        />
      ))}
    </span>
  )
}

/**
 * TripAdvisor-style rating: five circles ("bubbles") filled left-to-right to
 * the score (supports fractional fill via a clipped overlay), followed by the
 * numeric value and an optional review count. The visual is decorative
 * (aria-hidden); the meaning is exposed via an aria-label on the wrapper.
 */
export function RatingBubbles({ rating, count, size = 'sm', className }: RatingBubblesProps) {
  const clamped = Math.max(0, Math.min(5, Number.isFinite(rating) ? rating : 0))
  const fillPct = (clamped / 5) * 100
  const px = BUBBLE_PX[size]
  const trackWidth = px * 5 + GAP_PX * 4
  const value = clamped.toFixed(1)
  const label =
    count != null
      ? `${value} of 5 bubbles, ${count} reviews`
      : `${value} of 5 bubbles`

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} aria-label={label}>
      <span
        className="relative inline-block shrink-0"
        style={{ width: trackWidth, height: px }}
        aria-hidden="true"
      >
        <span className="absolute inset-0">
          <BubbleRow filled={false} px={px} />
        </span>
        <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPct}%` }}>
          <span className="block" style={{ width: trackWidth }}>
            <BubbleRow filled px={px} />
          </span>
        </span>
      </span>
      <span className="text-xs font-semibold text-foreground">{value}</span>
      {count != null ? <span className="text-xs text-muted-foreground">({count})</span> : null}
    </span>
  )
}
