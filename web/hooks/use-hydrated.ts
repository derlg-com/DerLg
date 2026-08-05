'use client'

import * as React from 'react'

// A no-op subscribe: hydration status never changes after the first client render.
const subscribe = () => () => {}

/**
 * True once the component has hydrated on the client, false during SSR and the
 * first render pass.
 *
 * Uses `useSyncExternalStore` rather than `useState` + `useEffect` so it does not
 * trigger the cascading render that React 19 flags via `set-state-in-effect`.
 */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
