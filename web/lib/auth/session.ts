/**
 * Session state as an external store.
 *
 * The access token lives in memory ONLY — never localStorage. A token in
 * localStorage is readable by any script that gets injected into the page, and it
 * survives long after the tab is closed. The refresh token is an httpOnly cookie
 * the browser cannot read at all, so a reload re-establishes the session by
 * calling `refresh` rather than by persisting anything sensitive.
 *
 * Kept outside React so `useSyncExternalStore` can read it without a
 * setState-in-effect cascade.
 */
import type { User } from '@/schemas/domain'

export interface Session {
  token: string | null
  user: User | null
  /** False until the initial refresh attempt has settled. */
  ready: boolean
}

const EMPTY: Session = { token: null, user: null, ready: false }

let session: Session = EMPTY
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

export function getSession(): Session {
  return session
}

/** Server snapshot: SSR always renders the guest view. */
export function getServerSession(): Session {
  return EMPTY
}

export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setSession(next: Partial<Session>): void {
  session = { ...session, ...next }
  emit()
}

export function clearSession(): void {
  session = { token: null, user: null, ready: true }
  emit()
}

/** Reset hook for tests. */
export function resetSessionForTests(): void {
  session = EMPTY
  listeners.clear()
}
