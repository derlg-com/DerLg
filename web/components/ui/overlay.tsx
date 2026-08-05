'use client'

import { X } from 'lucide-react'
import * as React from 'react'
import { createPortal } from 'react-dom'

import { useFocusTrap, useScrollLock } from '@/hooks/use-focus-trap'
import { useHydrated } from '@/hooks/use-hydrated'
import { cn } from '@/lib/cn'

import { Button } from './button'

type Side = 'center' | 'bottom' | 'right'

export interface OverlaySurfaceProps {
  open: boolean
  onClose: () => void
  title: string
  /** Hide the title visually while keeping it as the accessible name. */
  hideTitle?: boolean
  description?: string
  /** `center` = dialog, `bottom` = mobile sheet, `right` = side panel. */
  side?: Side
  className?: string
  children: React.ReactNode
  /** Suppress the built-in close button when a custom footer owns dismissal. */
  hideCloseButton?: boolean
}

const surfaceBySide: Record<Side, string> = {
  center:
    'left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg',
  bottom: 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-lg',
  right: 'inset-y-0 right-0 w-full max-w-md sm:rounded-l-lg',
}

/**
 * Shared modal surface behind Dialog and Sheet.
 *
 * Handles the full modal contract: portal, backdrop click, Escape, focus trap,
 * scroll lock, `role="dialog"`, `aria-modal`, and labelled title/description.
 */
function OverlaySurface({
  open,
  onClose,
  title,
  hideTitle = false,
  description,
  side = 'center',
  className,
  children,
  hideCloseButton = false,
}: OverlaySurfaceProps) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  const descriptionId = React.useId()
  const hydrated = useHydrated()

  // Gate on hydration as well: the portal does not exist during SSR or the first
  // render, so a trap keyed only on `open` would find a null ref and never re-run.
  useFocusTrap(panelRef, open && hydrated)
  useScrollLock(open)

  React.useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!hydrated || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        data-testid="overlay-backdrop"
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'absolute flex flex-col overflow-hidden border border-[var(--border-default)] bg-[var(--surface)] outline-none',
          surfaceBySide[side],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] p-4">
          <div className="min-w-0 space-y-1">
            <h2
              id={titleId}
              className={cn(
                'text-base font-semibold tracking-tight',
                hideTitle && 'sr-only',
              )}
            >
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-sm text-[var(--text-secondary)]">
                {description}
              </p>
            ) : null}
          </div>
          {hideCloseButton ? null : (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X aria-hidden="true" className="size-4" />
            </Button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/** Centred modal dialog. */
export function Dialog(props: Omit<OverlaySurfaceProps, 'side'>) {
  return <OverlaySurface {...props} side="center" />
}

/** Edge-anchored panel: bottom sheet on mobile, side panel on desktop. */
export function Sheet({ side = 'bottom', ...props }: OverlaySurfaceProps) {
  return <OverlaySurface {...props} side={side} />
}
