'use client'

import { RatingBubbles } from '@/components/ui/rating-bubbles'
import { useTranslations } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ReviewSummary } from '@/types/domain'

export interface ReviewSummaryCardProps {
  summary: ReviewSummary
  className?: string
}

const STAR_VALUES = [5, 4, 3, 2, 1] as const

/**
 * Aggregate rating block: large average score, bubble rating, total review
 * count, and an optional per-star breakdown bar chart when the backend supplies
 * `ratingBreakdown`. Display-only (task 10.3).
 */
export function ReviewSummaryCard({ summary, className }: ReviewSummaryCardProps) {
  const t = useTranslations('reviews')
  const { averageRating, reviewCount, ratingBreakdown } = summary
  const average = Number.isFinite(averageRating) ? averageRating : 0

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center',
        className,
      )}
    >
      <div className="flex shrink-0 flex-col items-center gap-1 sm:w-32">
        <span className="font-display text-4xl font-bold leading-none text-foreground">
          {average.toFixed(1)}
        </span>
        <RatingBubbles rating={average} size="sm" />
        <span className="text-xs text-muted-foreground">{t('count', { count: reviewCount })}</span>
      </div>

      {ratingBreakdown ? (
        <div className="flex flex-1 flex-col gap-1.5" aria-label={t('breakdownLabel')}>
          {STAR_VALUES.map((star) => {
            const value = ratingBreakdown[String(star)] ?? 0
            const pct = reviewCount > 0 ? Math.round((value / reviewCount) * 100) : 0
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-3 shrink-0 text-right text-muted-foreground">{star}</span>
                <span
                  className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                  role="presentation"
                >
                  <span
                    className="block h-full rounded-full bg-rating"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">
                  {value}
                </span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
