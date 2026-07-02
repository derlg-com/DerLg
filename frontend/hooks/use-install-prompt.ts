'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  type BeforeInstallPromptEvent,
  isInstallDismissed,
  isIosFromNavigator,
  isStandalone,
  markInstallDismissed,
} from '@/lib/pwa-install'

export type InstallMode = 'none' | 'prompt' | 'ios'

export interface InstallPromptState {
  /**
   * Which affordance (if any) to show:
   *  - `'prompt'`: a deferred `beforeinstallprompt` is available → show an
   *    "Install app" button wired to {@link install}.
   *  - `'ios'`: iOS Safari (no programmatic prompt) → show manual
   *    "Add to Home Screen" instructions.
   *  - `'none'`: already installed, dismissed, or not installable yet.
   */
  mode: InstallMode
  /** Trigger the native install prompt (only meaningful when `mode === 'prompt'`). */
  install: () => Promise<void>
  /** Dismiss the affordance and remember it so we don't nag again. */
  dismiss: () => void
}

/**
 * Manage the PWA install affordance (task 19.4, Requirements 12.6, 12.7).
 *
 * Listens for the `beforeinstallprompt` event (Chromium/Android/desktop),
 * stashes it so it can be triggered from a user gesture, and exposes whether to
 * show the install button. On iOS Safari — which never fires that event — it
 * surfaces an `'ios'` mode so the UI can show manual instructions. The prompt is
 * suppressed entirely when the app is already installed (standalone) or the user
 * has previously dismissed it.
 */
export function useInstallPrompt(): InstallPromptState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  // Compute the initial mode lazily so we never call setState synchronously in
  // an effect body (project lint rule). iOS Safari starts in 'ios' (manual
  // instructions); everyone else starts in 'none' until beforeinstallprompt.
  const [mode, setMode] = useState<InstallMode>(() => {
    if (isStandalone() || isInstallDismissed()) return 'none'
    return isIosFromNavigator() ? 'ios' : 'none'
  })

  useEffect(() => {
    // Never prompt if already installed or the user opted out before.
    if (isStandalone() || isInstallDismissed()) return

    const onBeforeInstallPrompt = (event: Event) => {
      // Prevent Chrome's default mini-infobar; we present our own affordance.
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setMode('prompt')
    }

    const onInstalled = () => {
      // Once installed, hide the affordance and remember so we don't re-prompt.
      markInstallDismissed()
      setDeferred(null)
      setMode('none')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    // The event can only be used once; clear it regardless of outcome.
    setDeferred(null)
    setMode('none')
    if (outcome === 'dismissed') {
      // Respect an explicit decline so we don't immediately re-prompt.
      markInstallDismissed()
    }
  }, [deferred])

  const dismiss = useCallback(() => {
    markInstallDismissed()
    setDeferred(null)
    setMode('none')
  }, [])

  return { mode, install, dismiss }
}
