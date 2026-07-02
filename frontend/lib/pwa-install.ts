/**
 * PWA install-prompt helpers (task 19.4, Requirements 12.6, 12.7).
 *
 * Pure, framework-free logic for the install affordance so it can be unit
 * tested without a DOM-heavy component:
 *  - environment detection (already-installed / iOS Safari), and
 *  - dismissal persistence in `localStorage` so we never nag a user who has
 *    already dismissed (or installed) the app.
 *
 * The actual `beforeinstallprompt` capture and UI live in the React layer
 * (`hooks/use-install-prompt.ts` + `components/shared/InstallPrompt.tsx`).
 */

/** `localStorage` key recording that the user dismissed the install prompt. */
export const INSTALL_DISMISSED_KEY = 'derlg:pwa:install-dismissed'

/**
 * The subset of the (non-standard) `beforeinstallprompt` event we rely on.
 * Typed here because it is not in the DOM lib typings.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt: () => Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
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

/** Whether the user has previously dismissed the install prompt. */
export function isInstallDismissed(): boolean {
  const storage = getStorage()
  if (!storage) return false
  try {
    return storage.getItem(INSTALL_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

/** Record that the user dismissed (or completed) the install flow. */
export function markInstallDismissed(): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(INSTALL_DISMISSED_KEY, '1')
  } catch {
    // Quota / privacy mode — non-fatal; worst case we may prompt again later.
  }
}

/**
 * Whether the app is already running as an installed PWA (standalone display
 * mode, or iOS' legacy `navigator.standalone`). When true, no install prompt
 * should ever be shown.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  } catch {
    // matchMedia may be unavailable in some environments.
  }
  // iOS Safari exposes this non-standard flag instead of display-mode.
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}

/**
 * Whether the current browser is iOS Safari, which does NOT fire
 * `beforeinstallprompt`. For these users we show manual "Add to Home Screen"
 * instructions instead of a programmatic prompt (Requirement 12.7).
 *
 * Detects iPhone/iPad/iPod, plus iPadOS 13+ which reports as desktop Safari but
 * exposes a touch-capable Macintosh UA.
 */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  if (/iphone|ipad|ipod/i.test(userAgent)) return true
  // iPadOS 13+ masquerades as macOS; disambiguate via touch support.
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return true
  return false
}

/** Convenience wrapper around {@link isIos} reading from the live navigator. */
export function isIosFromNavigator(): boolean {
  if (typeof navigator === 'undefined') return false
  return isIos(navigator.userAgent, navigator.maxTouchPoints ?? 0)
}
