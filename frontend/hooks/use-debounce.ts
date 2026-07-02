'use client'

import { useEffect, useState } from 'react'

/** Default debounce delay (ms) used across search inputs (Requirement 4.5). */
export const DEFAULT_DEBOUNCE_MS = 300

/**
 * Return a debounced copy of `value` that only updates after `delayMs` have
 * elapsed without a further change. Mirrors the inline debounce already used by
 * the global {@link SearchView} (300ms), extracted into a reusable hook so the
 * Explore Places/Festivals search boxes (task 8.4, Requirement 4.5) can share
 * the same behavior.
 *
 * The timer is reset on every `value` change and cleared on unmount, so rapid
 * typing collapses to a single trailing update.
 */
export function useDebounce<T>(value: T, delayMs: number = DEFAULT_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
