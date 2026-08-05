'use client'

import * as React from 'react'

import { cn } from '@/lib/cn'

/**
 * Toggle chip group for single-select list filters (hotel type, vehicle tier,
 * ...). An alternative to a Select for short option lists that fit on screen.
 *
 * Each chip is a real button carrying `aria-pressed`, so the group reads as a
 * set of toggle buttons; the wrapping element gets a label via the parent
 * `Field`'s htmlFor/id pairing being bypassed by buttons, so the group exposes
 * an `aria-label` instead.
 */
export function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value?: string
  onChange: (value: string | undefined) => void
}) {
  const groupId = React.useId()

  return (
    <div className="min-w-0">
      <span id={groupId} className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
        {label}
      </span>
      <div role="group" aria-labelledby={groupId} className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? undefined : option.value)}
              className={cn(
                'inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors duration-[var(--duration-fast)] pointer-coarse:min-h-11',
                selected
                  ? 'border-transparent bg-[var(--accent)] text-[var(--accent-text)]'
                  : 'border-[var(--border-default)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
