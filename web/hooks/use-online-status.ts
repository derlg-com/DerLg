'use client'

import * as React from 'react'

/**
 * Browser online/offline status.
 *
 * `navigator.onLine` only reports whether an interface is up, not whether the
 * backend is reachable, so this is used for a hint banner rather than to block
 * requests outright.
 */
export function useOnlineStatus(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
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
  return navigator.onLine
}

function getServerSnapshot(): boolean {
  // Assume online during SSR; the client corrects it on hydration.
  return true
}
