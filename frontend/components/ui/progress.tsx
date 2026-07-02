import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const progressIndicatorVariants = cva(
  'h-full rounded-full transition-[width] duration-300 ease-out',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        success: 'bg-success',
        warning: 'bg-warning',
        destructive: 'bg-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

const SIZES = { sm: 'h-1', md: 'h-2', lg: 'h-3' } as const

export interface ProgressProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, 'role'>,
    VariantProps<typeof progressIndicatorVariants> {
  /** Current value (0–max). Omit or pass null for an indeterminate bar. */
  value?: number | null
  /** Upper bound of the progress range. */
  max?: number
  /** Track thickness. */
  size?: keyof typeof SIZES
  /** Accessible label describing what is progressing. */
  label?: string
}

function clampPercent(value: number, max: number): number {
  if (max <= 0) return 0
  const ratio = (value / max) * 100
  if (Number.isNaN(ratio)) return 0
  return Math.min(100, Math.max(0, ratio))
}

/**
 * Linear progress bar for file uploads and long-running operations.
 * Pass a numeric `value` for determinate progress, or omit it for an
 * indeterminate (animated) bar while work is in flight.
 */
function Progress({
  value = null,
  max = 100,
  size = 'md',
  variant,
  label = 'Progress',
  className,
  ...props
}: ProgressProps) {
  const indeterminate = value === null || value === undefined
  const percent = indeterminate ? 0 : clampPercent(value, max)

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={indeterminate ? undefined : Math.round((percent / 100) * max)}
      aria-valuetext={indeterminate ? undefined : `${Math.round(percent)}%`}
      className={cn('w-full overflow-hidden rounded-full bg-muted', SIZES[size], className)}
      {...props}
    >
      <div
        className={cn(
          progressIndicatorVariants({ variant }),
          indeterminate && 'w-full animate-pulse',
        )}
        style={indeterminate ? undefined : { width: `${percent}%` }}
      />
    </div>
  )
}

export { Progress, progressIndicatorVariants }
