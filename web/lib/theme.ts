/**
 * Theme preference as an external store.
 *
 * Kept outside React so `useSyncExternalStore` can read it, which avoids the
 * setState-in-effect cascade that a useState + useEffect pair would cause. The
 * store owns three responsibilities: persistence, resolving `system` against the
 * OS setting, and applying the `dark` class to the document element.
 */

export type ThemePreference = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'derlg-theme'

const listeners = new Set<() => void>()

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

function read(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'system'
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isPreference(stored) ? stored : 'system'
  } catch {
    // localStorage can throw in private mode or sandboxed iframes.
    return 'system'
  }
}

// Cached so getSnapshot returns a stable value between writes; returning a fresh
// read on every call is fine for primitives but re-reading localStorage on each
// render is needless work.
let snapshot: ThemePreference | null = null

export function getThemeSnapshot(): ThemePreference {
  snapshot ??= read()
  return snapshot
}

export function getServerThemeSnapshot(): ThemePreference {
  return 'system'
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof document === 'undefined') return
  const isDark = resolveTheme(preference) === 'dark'
  document.documentElement.classList.toggle('dark', isDark)
  // Keep the browser chrome/status-bar colour in sync with the effective theme,
  // not the OS preference (which the static meta[media] approach can't track).
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', isDark ? '#09090b' : '#ffffff')
}

function emit(): void {
  listeners.forEach((listener) => listener())
}

export function setTheme(preference: ThemePreference): void {
  snapshot = preference
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, preference)
    }
  } catch {
    // localStorage can throw in private mode or sandboxed iframes.
  }
  applyTheme(preference)
  emit()
}

export function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener)

  // Follow the OS while the preference is `system`, and stay in sync with the
  // same app open in another tab.
  const media =
    typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: dark)')

  const onMediaChange = () => {
    if (getThemeSnapshot() === 'system') {
      applyTheme('system')
      emit()
    }
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return
    snapshot = isPreference(event.newValue) ? event.newValue : 'system'
    applyTheme(snapshot)
    emit()
  }

  media?.addEventListener('change', onMediaChange)
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    media?.removeEventListener('change', onMediaChange)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

/** Reset hook for tests. */
export function resetThemeStoreForTests(): void {
  snapshot = null
  listeners.clear()
}
