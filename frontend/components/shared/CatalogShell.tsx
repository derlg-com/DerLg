'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export type CatalogState = 'loading' | 'error' | 'empty' | 'ready'

interface CatalogShellProps {
  /** Filter controls (category chips, sort select…). */
  filters?: ReactNode
  /** Results count / inline toolbar above the grid. */
  toolbar?: ReactNode
  state: CatalogState
  /** Slots for the non-ready states (supply your own i18n'd EmptyState). */
  error?: ReactNode
  empty?: ReactNode
  /** The grid of cards (rendered only in the `ready` state). */
  children?: ReactNode
  pagination?: ReactNode
  skeletonCount?: number
  gridClassName?: string
  className?: string
}

/**
 * Standard catalog layout: filters → toolbar → state-aware grid
 * (loading skeletons / error / empty / cards) → pagination. Every booking
 * vertical composes this so the list UX stays identical and adding a vertical
 * is just data + cards.
 */
export function CatalogShell({
  filters,
  toolbar,
  state,
  error,
  empty,
  children,
  pagination,
  skeletonCount = 6,
  gridClassName,
  className,
}: CatalogShellProps) {
  const grid = cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', gridClassName)
  return (
    <div className={cn('mx-auto max-w-5xl space-y-4 px-4 py-4', className)}>
      {filters ? <div className="space-y-3">{filters}</div> : null}
      {toolbar ?? null}

      {state === 'loading' ? (
        <div className={grid} aria-busy="true">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : state === 'error' ? (
        error
      ) : state === 'empty' ? (
        empty
      ) : (
        <div className={grid}>{children}</div>
      )}

      {state === 'ready' && pagination ? pagination : null}
    </div>
  )
}
