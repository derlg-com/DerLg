import { cn } from '@/lib/cn'

import { Button } from './button'

/**
 * EmptyState — a zero-result surface that always offers a next action, so the
 * user is never left at a dead end.
 *
 * `action` is a node rather than a label/handler pair so callers can pass a real
 * link where the next step is navigation (which survives reload and works before
 * JavaScript loads) or a button where it is a local state change. Keeping the
 * decision with the caller also keeps this primitive free of routing imports.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--border-default)] px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <span className="text-[var(--text-tertiary)]">{icon}</span> : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-[var(--text-secondary)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

/**
 * ErrorState — failure surface with a retry affordance. Uses `role="alert"` so
 * the failure is announced, and never renders a raw error string to the user.
 */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Try again',
  className,
}: {
  title: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-[var(--tone-danger-bg)] bg-[var(--tone-danger-bg)] px-6 py-10 text-center',
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-[var(--text-secondary)]">{description}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}
