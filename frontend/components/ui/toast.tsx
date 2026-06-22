'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMounted } from '@/hooks/use-mounted'

export type ToastVariant = 'default' | 'success' | 'error'

export interface ToastItem {
  id: string
  title?: string
  description?: string
  variant: ToastVariant
}

interface ToastStore {
  toasts: ToastItem[]
  add: (t: ToastItem) => void
  remove: (id: string) => void
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (t) => set((s) => ({ toasts: [...s.toasts, t] })),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export interface ToastOptions {
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

/** Fire a toast from anywhere (event handlers, mutations). Auto-dismisses. */
export function toast({ title, description, variant = 'default', duration = 4000 }: ToastOptions) {
  const id = uuid()
  useToastStore.getState().add({ id, title, description, variant })
  if (duration > 0) {
    setTimeout(() => useToastStore.getState().remove(id), duration)
  }
  return id
}

const ICONS: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  error: AlertCircle,
}

const ICON_TONE: Record<ToastVariant, string> = {
  default: 'text-foreground',
  success: 'text-success',
  error: 'text-destructive',
}

/** Mount once near the root. Renders active toasts in a portal. */
function Toaster() {
  const mounted = useMounted()
  const toasts = useToastStore((s) => s.toasts)
  const remove = useToastStore((s) => s.remove)
  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-4 sm:bottom-0 sm:top-auto sm:items-end"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.variant]
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg"
          >
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', ICON_TONE[t.variant])} aria-hidden />
            <div className="min-w-0 flex-1">
              {t.title ? <p className="text-sm font-medium">{t.title}</p> : null}
              {t.description ? (
                <p className="text-sm text-muted-foreground">{t.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
              className="rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}

export { Toaster, useToastStore }
