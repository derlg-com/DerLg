'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { usePreferencesStore } from '@/stores/preferences.store'

/**
 * Push notification setup (task 26.1, Requirements 19.1–19.3).
 *
 * Feature-detects the browser APIs required for web push — `Notification`,
 * `navigator.serviceWorker`, and `PushManager` — and exposes a small surface to
 * request permission, subscribe via the existing Serwist service worker
 * (`/sw.js`, see app/sw.ts), and report state. Everything degrades gracefully:
 *
 * - On a browser/SSR context lacking any of the APIs, `isSupported` is false and
 *   all actions no-op.
 * - VAPID/FCM key (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`) is OPTIONAL. When absent we
 *   cannot create a real `PushSubscription`, so we fall back to permission-only
 *   mode (local notifications still work). This is the FCM/Firebase env gap:
 *   without the key, server-delivered push is unavailable but the app never
 *   crashes.
 * - Sending the subscription to the backend assumes `POST /v1/notifications/
 *   subscribe`. If that endpoint is absent the failure is swallowed (logged in
 *   dev) and the local permission/subscription still stands.
 * - Respects the user's push preference (task 26.4): `requestPermission` will
 *   not prompt when the push pref is disabled.
 */

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

/** True when all browser APIs needed for web push exist (SSR-safe). */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

/** Convert a base64url VAPID key to the BufferSource the PushManager expects. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export interface UsePushNotificationsReturn {
  isSupported: boolean
  permission: PushPermission
  isSubscribed: boolean
  /** Whether the user's push preference allows prompting/subscribing. */
  pushEnabledPref: boolean
  /** Request permission (no-op if unsupported or pref disabled). Returns result. */
  requestPermission: () => Promise<PushPermission>
  /** Request permission then subscribe + report to backend. Returns success. */
  subscribe: () => Promise<boolean>
  /** Unsubscribe locally + best-effort notify backend. */
  unsubscribe: () => Promise<void>
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<PushPermission>('unsupported')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const pushEnabledPref = usePreferencesStore((s) => s.notifications.push)

  useEffect(() => {
    // Sync local state from external browser APIs (Notification permission +
    // existing PushSubscription). This is the documented "subscribe to an
    // external system" case; the mount-time set is intentional.
    if (!isPushSupported()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported(false)
      setPermission('unsupported')
      return
    }
    setSupported(true)
    setPermission(Notification.permission as PushPermission)
    // Reflect any existing subscription.
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(Boolean(sub)))
      .catch(() => setIsSubscribed(false))
  }, [])

  const requestPermission = useCallback(async (): Promise<PushPermission> => {
    if (!isPushSupported()) return 'unsupported'
    // Respect the user's preference (task 26.4): don't prompt if disabled.
    if (!pushEnabledPref) return Notification.permission as PushPermission
    try {
      const result = await Notification.requestPermission()
      setPermission(result as PushPermission)
      return result as PushPermission
    } catch {
      return Notification.permission as PushPermission
    }
  }, [pushEnabledPref])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported() || !pushEnabledPref) return false
    const perm = await requestPermission()
    if (perm !== 'granted') return false

    try {
      const reg = await navigator.serviceWorker.ready

      // Without a VAPID key we can't create a real push subscription — fall back
      // to permission-only mode (local notifications work; server push doesn't).
      if (!VAPID_PUBLIC_KEY) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set — server push disabled (permission-only).',
          )
        }
        return true
      }

      const existing = await reg.pushManager.getSubscription()
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }))

      setIsSubscribed(true)

      // Report to backend (assumed endpoint). Best-effort: swallow if absent.
      try {
        await api.post('/v1/notifications/subscribe', { subscription: sub.toJSON() })
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[push] subscribe report failed (endpoint may be absent):', err)
        }
      }
      return true
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[push] subscription failed:', err)
      }
      return false
    }
  }, [pushEnabledPref, requestPermission])

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isPushSupported()) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        try {
          await api.post('/v1/notifications/unsubscribe', { endpoint: sub.endpoint })
        } catch {
          // endpoint may be absent — local unsubscribe already done.
        }
      }
      setIsSubscribed(false)
    } catch {
      // ignore — best-effort cleanup
    }
  }, [])

  return {
    isSupported: supported,
    permission,
    isSubscribed,
    pushEnabledPref,
    requestPermission,
    subscribe,
    unsubscribe,
  }
}
