'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { type QueuedAction, flushQueue, queueSize } from '@/lib/offline-queue'
import { type SyncStatus, useSyncStore } from '@/stores/sync.store'

export type { SyncStatus }

export interface OfflineQueueSync {
  /** Coarse status used to drive the indicator UI. */
  status: SyncStatus
  /** Number of actions still waiting to be synced. */
  pending: number
  /** Manually trigger a flush (also called automatically on reconnect). */
  sync: () => Promise<void>
}

/**
 * Drive replay of the offline action queue (task 19.5, Requirements 12.9, 48.6).
 *
 * Watches connectivity via {@link useOnlineStatus} and, whenever the app
 * transitions back online with queued actions, replays them in order using the
 * supplied `replay` transport. Status/pending live in {@link useSyncStore} (a
 * Zustand store) so this hook can update them from effects without violating the
 * project's lint rule against synchronous `setState` in effect bodies.
 *
 * The `replay` function performs each mutation (e.g. the matching API call for
 * the action type). It must reject on failure so the queue keeps the action for
 * a later retry.
 */
export function useOfflineQueueSync(
  replay: (action: QueuedAction) => Promise<void>,
): OfflineQueueSync {
  const online = useOnlineStatus()
  const status = useSyncStore((s) => s.status)
  const pending = useSyncStore((s) => s.pending)
  const setSync = useSyncStore((s) => s.set)

  // Keep the latest replay fn without re-subscribing the reconnect effect.
  const replayRef = useRef(replay)
  useEffect(() => {
    replayRef.current = replay
  }, [replay])

  // Guard against overlapping flushes (e.g. rapid online/offline flapping).
  const flushing = useRef(false)

  // Reflect the persisted queue size on mount so the indicator is correct after
  // a reload with pending actions. Writes go through the store action.
  useEffect(() => {
    const size = queueSize()
    setSync({ pending: size, status: size > 0 ? 'pending' : 'idle' })
  }, [setSync])

  const sync = useCallback(async () => {
    if (flushing.current) return
    if (queueSize() === 0) {
      setSync({ pending: 0, status: 'idle' })
      return
    }
    flushing.current = true
    setSync({ pending: queueSize(), status: 'syncing' })
    try {
      const { remaining } = await flushQueue((action) => replayRef.current(action))
      setSync({ pending: remaining, status: remaining === 0 ? 'synced' : 'error' })
    } catch {
      setSync({ pending: queueSize(), status: 'error' })
    } finally {
      flushing.current = false
    }
  }, [setSync])

  // Flush when connectivity is (re)established and there is work to do.
  useEffect(() => {
    if (online && queueSize() > 0) {
      void sync()
    }
  }, [online, sync])

  return { status, pending, sync }
}
