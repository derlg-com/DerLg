'use client'

import * as React from 'react'

import { cn } from '@/lib/cn'

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  hideLabel?: boolean
  description?: string
  disabled?: boolean
  className?: string
}

/**
 * Switch — an immediate-effect toggle, as distinct from a checkbox that only
 * takes effect on submit. Implemented on a native button with `role="switch"`.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  hideLabel = false,
  description,
  disabled = false,
  className,
}: SwitchProps) {
  const id = React.useId()
  const descriptionId = description ? `${id}-description` : undefined

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        // 44px hit area via padding while the visual track stays compact.
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent',
          'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-quick)]',
          'after:absolute after:-inset-2.5 after:content-[""]',
          checked ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none ml-0.5 size-5 rounded-full bg-white',
            'transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-quick)]',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>

      <div className="min-w-0 space-y-0.5">
        <label
          htmlFor={id}
          className={cn(
            'block text-sm font-medium text-[var(--text-primary)]',
            hideLabel && 'sr-only',
            !disabled && 'cursor-pointer',
          )}
        >
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-xs text-[var(--text-tertiary)]">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}
