'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface DialogContextValue {
  onClose: () => void
}
const DialogContext = React.createContext<DialogContextValue | null>(null)

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

/**
 * Controlled modal dialog. Renders into a portal with an overlay, focus trap,
 * Esc-to-close, and body scroll lock. Open it via interaction (state), not on
 * the initial server render, to stay hydration-safe.
 */
function Dialog({ open, onOpenChange, children }: DialogProps) {
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
    <DialogContext.Provider value={{ onClose: () => onOpenChange(false) }}>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <div
          className="absolute inset-0 bg-black/50"
          aria-hidden
          onClick={() => onOpenChange(false)}
        />
        {children}
      </div>
    </DialogContext.Provider>,
    document.body,
  )
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  showClose?: boolean
}

function DialogContent({ className, children, showClose = true, ...props }: DialogContentProps) {
  const ctx = React.useContext(DialogContext)
  const ref = React.useRef<HTMLDivElement>(null)
  useFocusTrap(ref, true, ctx?.onClose)

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      className={cn(
        'relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-xl border border-border bg-card p-4 shadow-lg',
        'sm:max-w-lg sm:rounded-xl sm:p-6',
        className,
      )}
      {...props}
    >
      {showClose && ctx ? (
        <button
          type="button"
          onClick={ctx.onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-5 w-5" />
        </button>
      ) : null}
      {children}
    </div>
  )
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col gap-1.5 pr-8', className)} {...props} />
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold text-foreground', className)} {...props} />
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }
