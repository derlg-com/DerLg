'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface RadioProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size'
> {
  /** Optional label rendered to the right of the control and wired via `htmlFor`. */
  label?: React.ReactNode
  /** Optional helper/description text rendered under the label. */
  description?: React.ReactNode
  /** Marks the field invalid; applies a destructive border and sets `aria-invalid`. */
  invalid?: boolean
}

/**
 * Accessible radio built on a visually-hidden native `<input type="radio">`.
 * Group radios by passing the same `name` (or use {@link RadioGroup}).
 */
const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, description, invalid, id, disabled, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId

    return (
      <div className={cn('flex items-start gap-2.5', className)}>
        <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
          <input
            ref={ref}
            id={inputId}
            type="radio"
            disabled={disabled}
            className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-full opacity-0 disabled:cursor-not-allowed"
            {...props}
          />
          <span
            aria-hidden
            className={cn(
              'pointer-events-none flex h-5 w-5 items-center justify-center rounded-full border border-input bg-background transition-colors',
              'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
              'peer-checked:border-primary',
              'peer-disabled:opacity-50',
              '[&>span]:scale-0 peer-checked:[&>span]:scale-100',
              invalid && 'border-destructive',
            )}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-primary transition-transform" />
          </span>
        </span>
        {(label || description) && (
          <span className="flex flex-col gap-0.5">
            {label ? (
              <label
                htmlFor={inputId}
                className={cn(
                  'text-sm font-medium leading-tight text-foreground',
                  disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
                )}
              >
                {label}
              </label>
            ) : null}
            {description ? (
              <span className="text-xs leading-snug text-muted-foreground">{description}</span>
            ) : null}
          </span>
        )}
      </div>
    )
  },
)
Radio.displayName = 'Radio'

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Accessible label describing the group of choices. */
  'aria-label'?: string
}

/**
 * Lightweight wrapper that exposes a `radiogroup` role and stacks {@link Radio}
 * children. State is managed by the consumer via each radio's `name`/`checked`.
 */
const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} role="radiogroup" className={cn('flex flex-col gap-3', className)} {...props}>
      {children}
    </div>
  ),
)
RadioGroup.displayName = 'RadioGroup'

export { Radio, RadioGroup }
