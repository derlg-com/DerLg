'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface SheetContextValue {
  onClose: () => void
}
const SheetContext = React.createContext<SheetContextValue | null>(null)

type SheetSide = 'right' | 'left' | 'bottom'

export interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function Sheet({ open, onOpenChange, children }: SheetProps) {
  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <SheetContext.Provider value={{ onClose: () => onOpenChange(false) }}>
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/50" aria-hidden onClick={() => onOpenChange(false)} />
        {children}
      </div>
    </SheetContext.Provider>,
    document.body,
  )
}

const SIDE_CLASSES: Record<SheetSide, string> = {
  right: 'inset-y-0 right-0 h-full w-[88%] max-w-sm border-l',
  left: 'inset-y-0 left-0 h-full w-[88%] max-w-sm border-r',
  bottom: 'inset-x-0 bottom-0 max-h-[88vh] w-full rounded-t-xl border-t',
}

export interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: SheetSide
  title?: string
}

function SheetContent({ className, children, side = 'right', title, ...props }: SheetContentProps) {
  const ctx = React.useContext(SheetContext)
  const ref = React.useRef<HTMLDivElement>(null)
  useFocusTrap(ref, true, ctx?.onClose)

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={cn(
        'absolute z-10 flex flex-col overflow-y-auto border-border bg-card p-4 shadow-xl sm:p-6',
        SIDE_CLASSES[side],
        className,
      )}
      {...props}
    >
      <div className="mb-2 flex items-center justify-between">
        {title ? <h2 className="text-lg font-semibold text-foreground">{title}</h2> : <span />}
        {ctx ? (
          <button
            type="button"
            onClick={ctx.onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  )
}

export { Sheet, SheetContent }
