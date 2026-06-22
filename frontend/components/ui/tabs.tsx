'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  setValue: (v: string) => void
}
const TabsContext = React.createContext<TabsContextValue | null>(null)

export interface TabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

function Tabs({ value, defaultValue, onValueChange, children, className }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? '')
  const isControlled = value !== undefined
  const current = isControlled ? value : internal
  const setValue = React.useCallback(
    (v: string) => {
      if (!isControlled) setInternal(v)
      onValueChange?.(v)
    },
    [isControlled, onValueChange],
  )
  return (
    <TabsContext.Provider value={{ value: current, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

function TabsTrigger({ value, className, ...props }: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext)
  const selected = ctx?.value === value

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const list = e.currentTarget.parentElement
    if (!list) return
    const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    const idx = tabs.indexOf(e.currentTarget)
    const next = e.key === 'ArrowRight' ? tabs[idx + 1] : tabs[idx - 1]
    if (next) {
      next.focus()
      next.click()
    }
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      onClick={() => ctx?.setValue(value)}
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex min-w-fit items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

function TabsContent({ value, className, ...props }: TabsContentProps) {
  const ctx = React.useContext(TabsContext)
  if (ctx?.value !== value) return null
  return (
    <div role="tabpanel" className={cn('mt-4 focus-visible:outline-none', className)} {...props} />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
