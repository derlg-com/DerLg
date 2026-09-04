'use client'

import * as React from 'react'

import {
  applyTheme,
  getServerThemeSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeToTheme,
  type ThemePreference,
} from '@/lib/theme'

/**
 * Reads and writes the user's theme preference.
 *
 * The `dark` class is applied by an inline script before paint (see the root
 * layout) so there is no flash of the wrong theme; this hook keeps the class in
 * sync afterwards when the preference or the OS setting changes.
 */
export function useTheme(): {
  preference: ThemePreference
  setTheme: (preference: ThemePreference) => void
} {
  const preference = React.useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  )

  // Reconcile the DOM with the stored preference once on the client, covering the
  // case where the inline script is unavailable (for example in tests).
  React.useEffect(() => {
    applyTheme(preference)
  }, [preference])

  return { preference, setTheme }
}

export type { ThemePreference }
