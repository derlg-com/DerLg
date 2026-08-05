'use client'

import * as React from 'react'

import { cn } from '@/lib/cn'

/**
 * Tooltip — supplementary hint on hover AND keyboard focus.
 *
 * Never the only carrier of essential information: touch users get no hover, so
 * anything critical belongs in visible text or an aria-label instead.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content: string
  children: React.ReactElement<{ 'aria-describedby'?: string }>
  side?: 'top' | 'bottom'
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const id = React.useId()

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {React.cloneElement(children, { 'aria-describedby': open ? id : undefined })}
      {open ? (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 rounded-md border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 py-1 text-xs whitespace-nowrap text-[var(--text-primary)] shadow-sm',
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
            className,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  )
}

export interface PopoverProps {
  trigger: React.ReactNode
  children: React.ReactNode
  /** Accessible name for the popover surface. */
  label: string
  align?: 'start' | 'end'
  className?: string
}

/** Lets children dismiss the popover they live in, e.g. after a menu selection. */
const PopoverCloseContext = React.createContext<(() => void) | null>(null)

/**
 * Closes the surrounding Popover.
 *
 * A menu that stays open after a selection leaves the user to dismiss it
 * manually, so selection handlers should call this.
 */
export function usePopoverClose(): () => void {
  const close = React.useContext(PopoverCloseContext)
  return close ?? (() => {})
}

/**
 * Popover — click-triggered surface for menus and filter panels. Closes on
 * Escape and on outside click, and returns focus to the trigger.
 */
export function Popover({ trigger, children, label, align = 'start', className }: PopoverProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const id = React.useId()

  const close = React.useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  React.useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex"
      >
        {trigger}
      </button>

      {open ? (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={cn(
            'absolute top-full z-40 mt-1.5 min-w-56 rounded-lg border border-[var(--border-default)] bg-[var(--surface)] p-2 shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
        >
          <PopoverCloseContext.Provider value={close}>{children}</PopoverCloseContext.Provider>
        </div>
      ) : null}
    </div>
  )
}
