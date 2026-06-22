'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

/** Build a compact page window like [1, '…', 4, 5, 6, '…', 20]. */
function pageWindow(page: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | 'ellipsis')[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(total - 1, page + 1)
  if (start > 2) pages.push('ellipsis')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push('ellipsis')
  pages.push(total)
  return pages
}

function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null
  const pages = pageWindow(page, totalPages)
  const btn =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-border px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:pointer-events-none'

  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-center gap-1', className)}>
      <button
        type="button"
        className={btn}
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e-${i}`} className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? 'page' : undefined}
            className={cn(btn, p === page && 'border-primary bg-primary text-primary-foreground')}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className={btn}
        aria-label="Next page"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  )
}

export { Pagination, pageWindow }
