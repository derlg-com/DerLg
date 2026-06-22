import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DetailShellProps {
  /** Hero/gallery at the top (e.g. TripGallery). */
  hero?: ReactNode
  children: ReactNode
  /** When true, reserves bottom space for a fixed sticky CTA bar. */
  hasStickyCta?: boolean
  className?: string
}

/** Standard detail-page container: max-width, hero, stacked sections, CTA room. */
export function DetailShell({ hero, children, hasStickyCta = true, className }: DetailShellProps) {
  return (
    <div
      className={cn('mx-auto max-w-3xl space-y-6 px-4 py-4', hasStickyCta && 'pb-36', className)}
    >
      {hero}
      {children}
    </div>
  )
}
