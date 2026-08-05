'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 * Pagination for catalogue lists.
 *
 * Numbered pages rather than infinite scroll: results are shareable, the footer
 * stays reachable, and a user can return to where they were. Window is clamped so
 * the control keeps a stable width regardless of total page count.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}) {
  const t = useTranslations('common')

  if (totalPages <= 1) return null

  const windowSize = 5
  const start = Math.max(1, Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize + 1))
  const pages = Array.from({ length: Math.min(windowSize, totalPages) }, (_, i) => start + i)

  return (
    <nav aria-label={t('showOlder')} className={cn('flex items-center justify-center gap-1', className)}>
      <Button
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label={t('showOlder')}
      >
        ‹
      </Button>

      <ul className="flex items-center gap-1">
        {pages.map((entry) => (
          <li key={entry}>
            <button
              type="button"
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-sm font-medium tabular-nums pointer-coarse:min-h-11 pointer-coarse:min-w-11',
                entry === page
                  ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                  : 'border border-[var(--border-default)] hover:bg-[var(--surface-hover)]',
              )}
            >
              {entry}
            </button>
          </li>
        ))}
      </ul>

      <Button
        variant="secondary"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        ›
      </Button>
    </nav>
  )
}
