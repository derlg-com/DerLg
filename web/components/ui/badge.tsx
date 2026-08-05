import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/cn'

/**
 * Badge — status and metadata pill. Uses subtle tinted backgrounds so it never
 * competes with the single accent reserved for primary actions.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral:
          'border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-[var(--text-secondary)]',
        accent: 'border-transparent bg-[var(--accent-subtle)] text-[var(--accent-subtle-text)]',
        success: 'border-transparent bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]',
        warning: 'border-transparent bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]',
        danger: 'border-transparent bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]',
        info: 'border-transparent bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { badgeVariants }
