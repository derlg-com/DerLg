'use client'

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/cn'

type ToastTone = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  title: string
  description?: string
  tone: ToastTone
}

interface ToastContextValue {
  toasts: Toast[]
  show: (toast: Omit<Toast, 'id'>) => string
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION_MS = 5000

const toneConfig: Record<ToastTone, { icon: React.ReactNode; className: string }> = {
  success: {
    icon: <CheckCircle2 aria-hidden="true" className="size-4 text-[var(--tone-success-text)]" />,
    className: 'border-[var(--tone-success-border)]',
  },
  error: {
    icon: <XCircle aria-hidden="true" className="size-4 text-[var(--tone-danger-text)]" />,
    className: 'border-[var(--tone-danger-border)]',
  },
  warning: {
    icon: <AlertTriangle aria-hidden="true" className="size-4 text-[var(--tone-warning-text)]" />,
    className: 'border-[var(--tone-warning-border)]',
  },
  info: {
    icon: <Info aria-hidden="true" className="size-4 text-[var(--tone-info-text)]" />,
    className: 'border-[var(--border-default)]',
  },
}

export function ToastProvider({
  children,
  duration = DEFAULT_DURATION_MS,
}: {
  children: React.ReactNode
  duration?: number
}) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const show = React.useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = crypto.randomUUID()
      setToasts((current) => [...current, { ...toast, id }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      )
      return id
    },
    [dismiss, duration],
  )

  // Clear pending timers on unmount so tests and route changes do not leak them.
  React.useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach((timer) => clearTimeout(timer))
      map.clear()
    }
  }, [])

  const value = React.useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div
      // Polite live region: announces without interrupting the current task.
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-[var(--surface-raised)] p-3 shadow-lg',
            toneConfig[toast.tone].className,
          )}
        >
          <span className="mt-0.5 shrink-0">{toneConfig[toast.tone].icon}</span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-medium text-[var(--text-primary)]">{toast.title}</p>
            {toast.description ? (
              <p className="text-xs text-[var(--text-secondary)]">{toast.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label={`Dismiss: ${toast.title}`}
            className="-m-1 shrink-0 rounded-sm p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}
