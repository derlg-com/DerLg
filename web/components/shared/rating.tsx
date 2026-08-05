import { Star } from 'lucide-react'

import { cn } from '@/lib/cn'

/**
 * Rating display. Renders nothing when the item has no ratings yet, rather than
 * showing a misleading "0.0" — the seeded catalogue has many unrated items.
 */
export function Rating({
  average,
  count,
  locale,
  className,
}: {
  average: number | null | undefined
  count?: number | null
  locale: string
  className?: string
}) {
  if (average === null || average === undefined) return null

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average)

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <Star aria-hidden="true" className="size-3.5 fill-current text-[var(--color-warning-500)]" />
      <span className="tabular-nums">{formatted}</span>
      {typeof count === 'number' && count > 0 ? (
        <span className="text-[var(--text-tertiary)]">({count})</span>
      ) : null}
    </span>
  )
}
