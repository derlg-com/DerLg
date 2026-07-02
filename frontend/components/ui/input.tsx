import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Marks the field as invalid; applies destructive border/ring and sets aria-invalid. */
  invalid?: boolean
  /** Optional leading icon rendered inside the input (e.g. a search glyph). */
  startIcon?: React.ReactNode
  /** Optional trailing icon/control rendered inside the input. */
  endIcon?: React.ReactNode
}

const inputBase = cn(
  'flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground ring-offset-background transition-colors',
  'placeholder:text-muted-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
  'sm:h-10 sm:text-sm',
)

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, invalid, startIcon, endIcon, 'aria-invalid': ariaInvalid, ...props },
    ref,
  ) => {
    // aria-invalid resolves from the explicit prop first, then the `invalid` convenience flag.
    const resolvedInvalid = ariaInvalid ?? (invalid ? true : undefined)

    // Fast path: no icons -> render a bare input so existing call sites are byte-identical.
    if (!startIcon && !endIcon) {
      return (
        <input
          type={type}
          ref={ref}
          aria-invalid={resolvedInvalid}
          className={cn(inputBase, className)}
          {...props}
        />
      )
    }

    return (
      <div className="relative w-full">
        {startIcon && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground"
            aria-hidden
          >
            {startIcon}
          </span>
        )}
        <input
          type={type}
          ref={ref}
          aria-invalid={resolvedInvalid}
          className={cn(inputBase, startIcon && 'pl-10', endIcon && 'pr-10', className)}
          {...props}
        />
        {endIcon && (
          <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground">
            {endIcon}
          </span>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

export { Input }
