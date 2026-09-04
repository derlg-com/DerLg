'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/cn'

/**
 * ScrollRail — the mobile-first alternative to a grid.
 *
 * Horizontal snap scrolling with keyboard-reachable arrow controls on pointer
 * devices. The rail is a labelled group so screen-reader users understand it is
 * a scrollable collection rather than a flat list of links.
 */
export function ScrollRail({
  label,
  children,
  className,
  itemClassName,
}: {
  label: string
  children: React.ReactNode
  className?: string
  itemClassName?: string
}) {
  const railRef = React.useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = React.useState(false)

  React.useEffect(() => {
    const rail = railRef.current
    if (!rail) return

    function measure() {
      setOverflowing(rail!.scrollWidth > rail!.clientWidth + 1)
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [children])

  function scrollBy(direction: 1 | -1) {
    const rail = railRef.current
    if (!rail) return
    rail.scrollBy({ left: direction * Math.round(rail.clientWidth * 0.8), behavior: 'smooth' })
  }

  return (
    <div className={cn('relative', className)}>
      <div
        ref={railRef}
        role="group"
        aria-label={label}
        // A scrollable region must be reachable by keyboard: without tabIndex a
        // keyboard-only user cannot scroll the rail to reach items beyond the
        // fold. Arrow keys scroll it once focused.
        tabIndex={0}
        className={cn('snap-rail scroll-px-4 px-4 pb-2 sm:px-0', itemClassName)}
      >
        {children}
      </div>

      {overflowing ? (
        <div className="pointer-events-none absolute inset-y-0 hidden w-full items-center justify-between sm:flex">
          <RailButton direction="prev" onClick={() => scrollBy(-1)} label={`Scroll ${label} left`} />
          <RailButton direction="next" onClick={() => scrollBy(1)} label={`Scroll ${label} right`} />
        </div>
      ) : null}
    </div>
  )
}

function RailButton({
  direction,
  onClick,
  label,
}: {
  direction: 'prev' | 'next'
  onClick: () => void
  label: string
}) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'pointer-events-auto grid size-9 place-items-center rounded-full border border-[var(--border-default)] bg-[var(--surface)] text-[var(--text-secondary)] shadow-sm',
        'transition-colors duration-[var(--duration-fast)] hover:text-[var(--text-primary)]',
        'pointer-coarse:size-11',
        direction === 'prev' ? '-translate-x-1/2' : 'translate-x-1/2',
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  )
}
