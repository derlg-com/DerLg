'use client'

import { create } from 'zustand'

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'error'

interface SyncState {
  /** Coarse status of the offline action queue (drives the indicator UI). */
  status: SyncStatus
  /** Number of actions still waiting to be replayed. */
  pending: number
  set: (next: { status: SyncStatus; pending: number }) => void
}

/**
 * Shared state for offline-sync status (task 19.5, Requirements 12.9, 48.6).
 *
 * Kept in a Zustand store (rather than `useState`) so the reconnect-driven
 * `useOfflineQueueSync` hook can update it from inside effects/async callbacks
 * without tripping the project's `react-hooks/set-state-in-effect` rule — the
 * same pattern used by `use-online-status.ts` for connectivity.
 */
export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  pending: 0,
  set: ({ status, pending }) => set({ status, pending }),
}))
