'use client'

import * as React from 'react'

import { cn } from '@/lib/cn'

interface TabsContextValue {
  value: string
  setValue: (value: string) => void
  baseId: string
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext(component: string): TabsContextValue {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error(`${component} must be used inside <Tabs>`)
  return context
}

export interface TabsProps {
  /** Controlled value. Omit for uncontrolled with `defaultValue`. */
  value?: string
  defaultValue: string
  onValueChange?: (value: string) => void
  className?: string
  children: React.ReactNode
}

export function Tabs({ value, defaultValue, onValueChange, className, children }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue)
  const baseId = React.useId()
  const current = value ?? internal

  const setValue = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternal(next)
      onValueChange?.(next)
    },
    [value, onValueChange],
  )

  const context = React.useMemo(
    () => ({ value: current, setValue, baseId }),
    [current, setValue, baseId],
  )

  return (
    <TabsContext.Provider value={context}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

/**
 * TabList implements the WAI-ARIA roving tabindex pattern: only the selected
 * tab is tabbable, and Arrow/Home/End move selection between tabs.
 */
export function TabList({
  className,
  children,
  label,
}: {
  className?: string
  children: React.ReactNode
  label: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(event.key)) return

    const tabs = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])
    if (tabs.length === 0) return

    const index = tabs.findIndex((tab) => tab === document.activeElement)
    if (index === -1) return

    event.preventDefault()
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : tabs.length - 1

    tabs[next]?.focus()
    tabs[next]?.click()
  }

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'flex items-center gap-1 border-b border-[var(--border-subtle)] overflow-x-auto',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Tab({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  const { value: current, setValue, baseId } = useTabsContext('Tab')
  const selected = current === value

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => setValue(value)}
      className={cn(
        'relative min-h-10 shrink-0 px-3 text-sm font-medium whitespace-nowrap pointer-coarse:min-h-11',
        'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-quick)]',
        selected
          ? 'text-[var(--text-primary)] after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-[var(--accent)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function TabPanel({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  const { value: current, baseId } = useTabsContext('TabPanel')
  if (current !== value) return null

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      className={cn('pt-4 outline-none', className)}
    >
      {children}
    </div>
  )
}
