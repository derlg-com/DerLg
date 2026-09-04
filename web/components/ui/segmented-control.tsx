'use client'

import * as React from 'react'

import { cn } from '@/lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
}

export interface SegmentedControlProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  /** Accessible group name, e.g. "View mode". */
  label: string
  className?: string
  size?: 'sm' | 'md'
}

/**
 * SegmentedControl — mutually exclusive choice among 2-4 options, as a radio
 * group so arrow keys and screen readers behave correctly.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
  size = 'md',
}: SegmentedControlProps<T>) {
  const ref = React.useRef<HTMLDivElement>(null)

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']
    if (!keys.includes(event.key)) return
    event.preventDefault()

    const index = options.findIndex((option) => option.value === value)
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const next = forward
      ? (index + 1) % options.length
      : (index - 1 + options.length) % options.length

    const nextOption = options[next]
    if (!nextOption) return
    onValueChange(nextOption.value)
    ref.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      ?.[next]?.focus()
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm px-3 text-sm font-medium whitespace-nowrap',
              'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-quick)]',
              size === 'sm' ? 'min-h-8 pointer-coarse:min-h-11' : 'min-h-9 pointer-coarse:min-h-11',
              selected
                ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
