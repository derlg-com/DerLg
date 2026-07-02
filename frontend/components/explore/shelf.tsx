'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface ShelfProps {
  title: string
  subtitle?: string
  seeAllHref?: string
  seeAllLabel?: string
  children: ReactNode
}

/**
 * A TripAdvisor-style content "shelf": a bold section header with optional
 * subtitle and "See all" link, above a horizontal snap-scroll carousel that
 * bleeds to the viewport edges (mirrors the page's px-4 gutter with -mx-4).
 */
export function Shelf({ title, subtitle, seeAllHref, seeAllLabel, children }: ShelfProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1 py-1 text-sm font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {seeAllLabel}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </section>
  )
}

/** Fixed-width snap target wrapping a single card inside a {@link Shelf}. */
export function ShelfItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('w-44 shrink-0 snap-start sm:w-52 md:w-60', className)}>{children}</div>
}

/** Loading placeholder row matching the shelf card footprint. */
export function ShelfSkeleton({ count = 4, square = false }: { count?: number; square?: boolean }) {
  return (
    <div className="-mx-4 flex gap-3 overflow-hidden px-4 pb-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-44 shrink-0 space-y-2 sm:w-56">
          <Skeleton
            className={cn('w-full rounded-2xl', square ? 'aspect-square' : 'aspect-[4/3]')}
          />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}
