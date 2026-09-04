import { cn } from '@/lib/cn'

/**
 * Skeleton — layout-stable loading placeholder.
 *
 * Callers must pass explicit dimensions so the skeleton occupies the same box
 * as the loaded content. That is what keeps CLS under the 0.1 target.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-[var(--surface-sunken)]', className)}
      {...props}
    />
  )
}

/** Announces a loading state to assistive tech while skeletons render. */
export function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
