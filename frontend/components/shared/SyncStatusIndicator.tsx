'use client'

import { CloudOff, RefreshCw, Check } from 'lucide-react'
import { useOfflineQueueSync } from '@/hooks/use-offline-queue-sync'
import { replayQueuedAction } from '@/lib/offline-replay'
import { useTranslations } from '@/lib/i18n'

/**
 * Offline-sync status indicator (task 19.5, Requirements 12.9, 48.6).
 *
 * Mounts the reconnect-driven queue flush ({@link useOfflineQueueSync}) and
 * surfaces its progress to the user: how many actions are waiting, when a sync
 * is in flight, and a brief "synced" confirmation. It renders nothing while the
 * queue is empty and idle, so it stays out of the way until there's something
 * to report.
 */
export function SyncStatusIndicator() {
  const { status, pending } = useOfflineQueueSync(replayQueuedAction)
  const t = useTranslations('sync')

  // Nothing queued and nothing to report → render nothing.
  if (status === 'idle' || (status === 'pending' && pending === 0)) return null

  const { icon, label, tone } = describe(status, pending, t)

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 top-2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm ${tone}`}
    >
      {icon}
      <span>{label}</span>
    </div>
  )
}

function describe(
  status: ReturnType<typeof useOfflineQueueSync>['status'],
  pending: number,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  switch (status) {
    case 'syncing':
      return {
        icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />,
        label: t('syncing'),
        tone: 'border-info/30 bg-info/10 text-info',
      }
    case 'synced':
      return {
        icon: <Check className="h-3.5 w-3.5" aria-hidden />,
        label: t('synced'),
        tone: 'border-success/30 bg-success/10 text-success',
      }
    case 'error':
      return {
        icon: <CloudOff className="h-3.5 w-3.5" aria-hidden />,
        label: t('error', { count: pending }),
        tone: 'border-warning/30 bg-warning/10 text-warning',
      }
    case 'pending':
    default:
      return {
        icon: <CloudOff className="h-3.5 w-3.5" aria-hidden />,
        label: t('pending', { count: pending }),
        tone: 'border-warning/30 bg-warning/10 text-warning',
      }
  }
}
