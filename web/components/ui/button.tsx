'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/cn'

/**
 * Button — the single accent colour lives here, on `primary` only.
 *
 * Every size keeps a >=44px interactive height on touch, which is why the
 * small variant still carries `min-h-11` rather than a bare `h-8`.
 */
const buttonVariants = cva(
  [
    'relative inline-flex select-none items-center justify-center gap-2',
    'rounded-md border text-sm font-medium whitespace-nowrap',
    'transition-[background-color,border-color,color,opacity]',
    'duration-[var(--duration-fast)] ease-[var(--ease-out-quick)]',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)]',
        secondary:
          'border-[var(--border-default)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]',
        ghost:
          'border-transparent bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-hover)]',
        danger:
          'border-transparent bg-[var(--color-danger-600)] text-white hover:bg-[var(--color-danger-500)]',
        link: 'border-transparent bg-transparent text-[var(--accent)] underline-offset-4 hover:underline',
      },
      size: {
        // Compact by default for precise pointers; expanded to the 44px
        // accessibility minimum on touch. Keyed on pointer type, not viewport
        // width, because a narrow desktop window still has a mouse.
        sm: 'min-h-9 px-3 py-1.5 text-sm pointer-coarse:min-h-11',
        md: 'min-h-10 px-4 py-2 pointer-coarse:min-h-11',
        lg: 'min-h-12 px-6 py-2.5 text-base',
        icon: 'min-h-9 min-w-9 p-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Shows a spinner, disables interaction, and marks the control busy. */
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
      {children}
    </button>
  )
})

export { buttonVariants }
