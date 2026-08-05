'use client'

import * as React from 'react'

import { cn } from '@/lib/cn'

const fieldBase = [
  'w-full rounded-md border border-[var(--border-default)] bg-[var(--surface)]',
  'px-3 text-sm text-[var(--text-primary)]',
  'placeholder:text-[var(--text-tertiary)]',
  'transition-[border-color] duration-[var(--duration-fast)] ease-[var(--ease-out-quick)]',
  'hover:border-[var(--border-strong)]',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-[invalid=true]:border-[var(--color-danger-500)]',
]

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      // Compact for precise pointers, 44px minimum on touch.
      className={cn(fieldBase, 'min-h-10 py-2 pointer-coarse:min-h-11', className)}
      {...props}
    />
  )
})

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 4, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(fieldBase, 'py-2', className)} {...props} />
})

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(fieldBase, 'min-h-10 py-2 pr-8 pointer-coarse:min-h-11', className)}
      {...props}
    >
      {children}
    </select>
  )
})

/**
 * Field — label + control + description/error wiring.
 *
 * Generates the id/aria-describedby/aria-invalid relationships so forms cannot
 * ship an unlabelled or unannounced-error control by accident.
 */
export interface FieldProps {
  label: string
  /** Hides the visual label but keeps it for screen readers. */
  hideLabel?: boolean
  description?: string
  error?: string
  required?: boolean
  className?: string
  children: (props: {
    id: string
    'aria-describedby': string | undefined
    'aria-invalid': boolean | undefined
    required: boolean | undefined
  }) => React.ReactNode
}

export function Field({
  label,
  hideLabel = false,
  description,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const id = React.useId()
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={id}
        className={cn(
          'block text-sm font-medium text-[var(--text-primary)]',
          hideLabel && 'sr-only',
        )}
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-[var(--text-danger)]">
            *
          </span>
        ) : null}
      </label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required: required || undefined,
      })}

      {description ? (
        <p id={descriptionId} className="text-xs text-[var(--text-tertiary)]">
          {description}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-[var(--text-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
