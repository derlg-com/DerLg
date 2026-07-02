'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size'
> {
  /** Optional label rendered to the right of the box and wired to the control via `htmlFor`. */
  label?: React.ReactNode
  /** Optional helper/description text rendered under the label. */
  description?: React.ReactNode
  /** Marks the field invalid; applies a destructive border and sets `aria-invalid`. */
  invalid?: boolean
}

/**
 * Accessible checkbox built on a visually-hidden native `<input type="checkbox">`.
 * The native input drives state and a11y; the styled box is a sibling overlay so
 * keyboard focus, form submission, and screen readers behave natively.
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { className, label, description, invalid, id, disabled, 'aria-invalid': ariaInvalid, ...props },
    ref,
  ) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId
    const resolvedInvalid = ariaInvalid ?? (invalid ? true : undefined)

    return (
      <div className={cn('flex items-start gap-2.5', className)}>
        <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            disabled={disabled}
            aria-invalid={resolvedInvalid}
            className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-[5px] opacity-0 disabled:cursor-not-allowed"
            {...props}
          />
          <span
            aria-hidden
            className={cn(
              'pointer-events-none flex h-5 w-5 items-center justify-center rounded-[5px] border border-input bg-background text-primary-foreground transition-colors',
              'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
              'peer-checked:border-primary peer-checked:bg-primary',
              'peer-disabled:opacity-50',
              '[&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100',
              resolvedInvalid && 'border-destructive',
            )}
          >
            <Check className="h-3.5 w-3.5 transition-opacity" strokeWidth={3} />
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
Checkbox.displayName = 'Checkbox'

export { Checkbox }
