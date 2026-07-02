/**
 * Offline action queue / "outbox" (task 19.5, Requirements 12.9, 48.6).
 *
 * ## What this is
 * A small, durable queue of mutating actions (e.g. profile updates, booking
 * cancellations) that the user triggers while offline. Each action is appended
 * here, then replayed in order when connectivity is restored
 * ({@link useOfflineQueueSync} drives the flush; the UI shows sync status).
 *
 * ## Storage choice — localStorage, not IndexedDB (documented deviation)
 * The design document suggests IndexedDB. We deliberately use `localStorage`
 * instead, matching the existing durable-queue pattern already in the codebase
 * (`derlg:vibe-booking:outbox` in `hooks/useWebSocket.ts`) and the offline-map
 * cache (`lib/offline-map-cache.ts`). Rationale:
 *  - The payloads are tiny (a handful of queued mutations), well within the
 *    ~5 MB localStorage budget — IndexedDB's scale isn't needed.
 *  - It is synchronous and trivially unit-testable with no async/transaction
 *    ceremony, keeping the queue logic simple and robust.
 *  - It is consistent with the rest of the app's persistence, so there is one
 *    mental model rather than two storage engines.
 * If a future action needs to store large blobs (e.g. queued photo uploads),
 * migrating this single module to IndexedDB would be the right move.
 *
 * This module is intentionally pure/storage-only (no React) so it is easy to
 * test. The replay/transport wiring lives in the hook.
 */

/** `localStorage` key for the offline action queue. */
export const OFFLINE_QUEUE_KEY = 'derlg:offline-queue:v1'

/** Schema version; a mismatch drops the stored queue (Requirement 48.8 spirit). */
export const OFFLINE_QUEUE_VERSION = 1

/** Upper bound on queued actions to keep the payload small and bounded. */
export const OFFLINE_QUEUE_MAX = 50

/**
 * Kinds of mutations we support replaying. Kept as a small explicit union so a
 * replayer can switch on it; extend as more offline-sensitive actions are wired.
 */
export type QueuedActionType = 'profile-update' | 'booking-cancel' | 'review-submit'

/** A single queued mutation. `payload` is the data needed to replay it. */
export interface QueuedAction {
  /** Stable client id (used for dedupe and for keying the status UI). */
  id: string
  type: QueuedActionType
  /** Arbitrary JSON-serializable data for the replayer. */
  payload: unknown
  /** Epoch ms when the action was enqueued. */
  createdAt: number
}

/** Persisted envelope. */
interface QueueSnapshot {
  version: number
  actions: QueuedAction[]
}

/** Safe handle to `localStorage`, or `null` when unavailable (SSR / blocked). */
function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

function isValidAction(value: unknown): value is QueuedAction {
  if (value === null || typeof value !== 'object') return false
  const a = value as Partial<QueuedAction>
  return (
    typeof a.id === 'string' &&
    (a.type === 'profile-update' || a.type === 'booking-cancel' || a.type === 'review-submit') &&
    typeof a.createdAt === 'number'
  )
}

/** Read the current queue, tolerating malformed/legacy data (returns `[]`). */
export function loadQueue(): QueuedAction[] {
  const storage = getStorage()
  if (!storage) return []
  const raw = storage.getItem(OFFLINE_QUEUE_KEY)
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (parsed === null || typeof parsed !== 'object') return []
  const snap = parsed as Partial<QueueSnapshot>
  if (snap.version !== OFFLINE_QUEUE_VERSION) return []
  if (!Array.isArray(snap.actions)) return []
  return snap.actions.filter(isValidAction).slice(0, OFFLINE_QUEUE_MAX)
}

/** Overwrite the persisted queue. Returns `false` if storage is unavailable. */
function writeQueue(actions: QueuedAction[]): boolean {
  const storage = getStorage()
  if (!storage) return false
  const snapshot: QueueSnapshot = {
    version: OFFLINE_QUEUE_VERSION,
    // Keep the most recent actions if we somehow exceed the cap.
    actions: actions.slice(-OFFLINE_QUEUE_MAX),
  }
  try {
    storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(snapshot))
    return true
  } catch {
    // Quota exceeded (Requirement 48.9) — non-fatal; the action just isn't queued.
    return false
  }
}

/**
 * Append an action to the queue and return the stored {@link QueuedAction}
 * (including its generated `id` and `createdAt`). Returns `null` when storage
 * is unavailable so callers can decide how to degrade.
 */
export function enqueueAction(type: QueuedActionType, payload: unknown): QueuedAction | null {
  const action: QueuedAction = {
    id: generateId(),
    type,
    payload,
    createdAt: Date.now(),
  }
  const next = [...loadQueue(), action]
  return writeQueue(next) ? action : null
}

/** Remove a single action by id (called after a successful replay). */
export function removeAction(id: string): void {
  const next = loadQueue().filter((a) => a.id !== id)
  writeQueue(next)
}

/** Empty the queue entirely. */
export function clearQueue(): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(OFFLINE_QUEUE_KEY)
  } catch {
    // best-effort
  }
}

/** Number of actions currently queued. */
export function queueSize(): number {
  return loadQueue().length
}

/**
 * Replay every queued action in FIFO order using the provided `replay`
 * transport. Each action that replays without throwing is removed from the
 * queue immediately (so a mid-flush failure never re-runs already-applied
 * actions). Returns counts so the UI can report sync status.
 *
 * On the first action that throws, the flush stops and leaves the remaining
 * actions queued for the next attempt (avoids reordering / partial chaos).
 */
export async function flushQueue(
  replay: (action: QueuedAction) => Promise<void>,
): Promise<{ synced: number; remaining: number }> {
  let synced = 0
  const actions = loadQueue()
  for (const action of actions) {
    try {
      await replay(action)
      removeAction(action.id)
      synced += 1
    } catch {
      // Stop on first failure; keep this and subsequent actions for retry.
      break
    }
  }
  return { synced, remaining: queueSize() }
}

/** Generate a reasonably-unique id without pulling in a dependency at module scope. */
function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
