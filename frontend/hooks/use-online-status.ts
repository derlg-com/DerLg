'use client'

import { useEffect } from 'react'
import { useSyncExternalStore } from 'react'
import { useShellStore } from '@/stores/shell.store'

/**
 * Subscribe to the browser's connectivity state (task 9.4, Requirement 11.9).
 *
 * Detection is driven by `navigator.onLine` plus the `online`/`offline` window
 * events. We read the live value through {@link useSyncExternalStore} so the
 * result is correct from the very first client render and never produces a
 * `setState`-in-effect (which the project's lint rule forbids and which the
 * previous inline `queueMicrotask` workaround only partially avoided).
 *
 * As a side effect the hook mirrors the value into {@link useShellStore} so
 * other surfaces that already read `shellStore.online` (e.g. for graceful
 * degradation) stay in sync without each having to attach their own listeners.
 *
 * SSR-safe: the server snapshot is always `true` (optimistic "online"), so the
 * markup is deterministic and hydration-stable; the real value is reconciled on
 * the client during the store subscription.
 */
export function useOnlineStatus(): boolean {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const setOnline = useShellStore((s) => s.setOnline)

  useEffect(() => {
    // Keep the shared shell store aligned with the live value. This runs after
    // commit (not during render) and only writes when the value actually
    // changes, so it never loops.
    setOnline(online)
  }, [online, setOnline])

  return online
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

function getSnapshot(): boolean {
  // `navigator.onLine` is `true` when the browser cannot determine connectivity,
  // which is the safe optimistic default.
  return navigator.onLine
}

function getServerSnapshot(): boolean {
  return true
}
