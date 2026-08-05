/**
 * Chat session id, persisted so a reload resumes the same conversation.
 *
 * Only the id is stored — never message content or tokens. The agent replaces any
 * value that is not a valid UUID, so this validates before reuse rather than
 * silently starting a new conversation on the server.
 */
const STORAGE_KEY = 'derlg-chat-session'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

/** Returns the stored session id, creating one when absent or corrupt. */
export function getOrCreateSessionId(): string {
  if (typeof localStorage === 'undefined') return crypto.randomUUID()

  const stored = localStorage.getItem(STORAGE_KEY)
  if (isUuid(stored)) return stored

  const created = crypto.randomUUID()
  try {
    localStorage.setItem(STORAGE_KEY, created)
  } catch {
    // Private mode can refuse writes; a per-tab session is an acceptable fallback.
  }
  return created
}

/** Starts a fresh conversation. */
export function resetSessionId(): string {
  const created = crypto.randomUUID()
  try {
    localStorage?.setItem(STORAGE_KEY, created)
  } catch {
    // Ignored: see above.
  }
  return created
}

/**
 * Stable guest identifier.
 *
 * The agent requires a `user_id` even for guests. Reusing one per browser keeps
 * its rate limiting meaningful; a fresh id on every load would let a guest bypass
 * it by reconnecting.
 */
const GUEST_KEY = 'derlg-guest-id'

export function getOrCreateGuestId(): string {
  if (typeof localStorage === 'undefined') return `guest-${crypto.randomUUID()}`

  const stored = localStorage.getItem(GUEST_KEY)
  if (stored && stored.startsWith('guest-')) return stored

  const created = `guest-${crypto.randomUUID()}`
  try {
    localStorage.setItem(GUEST_KEY, created)
  } catch {
    // Ignored: see above.
  }
  return created
}
