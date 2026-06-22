'use client'

import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}

/**
 * Returns `false` during SSR and the initial client (hydration) render, then
 * `true` after the component has mounted on the client. Uses
 * `useSyncExternalStore` so it stays consistent through hydration without a
 * `setState`-in-effect (which the project's lint rule forbids).
 *
 * Use this to gate portals/`document`-dependent UI that render unconditionally
 * (e.g. the Toaster), avoiding server/client hydration mismatches.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}
