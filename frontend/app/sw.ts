// Service Worker source for the DerLg PWA (Requirements 12.2, 12.3, 12.4).
//
// Compiled by the Serwist CLI (esbuild) into public/sw.js at build time.
// Excluded from the main Next.js tsconfig (it targets the WebWorker lib, not DOM);
// see tsconfig.sw.json for its dedicated type-check configuration.
// - Precaches the build manifest (static assets: CSS, JS, fonts, images).
// - Applies runtime caching: cache-first for static assets, network-first for
//   API requests, matching the offline architecture in the design document.
/// <reference lib="webworker" />

import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

// Custom offline fallback document (task 19.3, Requirement 12.8). Prerendered
// at /~offline and included in the precache manifest via `precachePrerendered`
// in serwist.config.mjs, so it is always available from the cache.
const OFFLINE_FALLBACK_URL = '/~offline'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected by Serwist at build time with the precache manifest.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // defaultCache provides Next.js-aware runtime caching strategies:
  // CacheFirst for static assets/fonts/images, NetworkFirst for pages and
  // data requests. This satisfies the cache-first/network-first requirement.
  //
  // Offline maps (task 9.3, Requirement 11): NOT a dedicated map-tile cache.
  // The app renders maps with the Google Maps JS SDK (@vis.gl/react-google-maps),
  // which fetches its tiles/imagery internally from Google's servers as opaque,
  // session-scoped cross-origin responses. Those responses cannot be reliably
  // (or lawfully, per Google Maps ToS) cached by a Service Worker, so we do NOT
  // add a tile-caching route here — doing so would only store unusable opaque
  // entries. The achievable offline-map support lives in the app layer instead:
  // ExploreMapTab persists the map's *entity data* (places/festivals with
  // coordinates) via lib/offline-map-cache and shows it as a saved-locations
  // list when offline. The Maps SDK's own static assets (e.g. fonts.gstatic.com)
  // already fall under defaultCache's cross-origin / font rules, which lets the
  // map shell load faster and degrade gracefully without bespoke handling.
  runtimeCaching: defaultCache,
  // When a navigation request can't be served (offline + uncached route), fall
  // back to the precached custom offline page instead of the browser's generic
  // error (task 19.3, Requirement 12.8).
  fallbacks: {
    entries: [
      {
        url: OFFLINE_FALLBACK_URL,
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
})

serwist.addEventListeners()

// -----------------------------------------------------------------------------
// Push notification handling (task 26.2, Requirements 19.4, 19.5).
//
// Feature-additive: this only augments the existing Serwist worker (it does NOT
// create a competing service worker). If no push is ever delivered (e.g. the
// app runs in permission-only mode without VAPID/FCM config — see
// hooks/use-push-notifications.ts), these listeners are simply never invoked, so
// the worker degrades gracefully.
//
// Expected (assumed) push payload shape (JSON), all fields optional:
//   { title?: string, body?: string, icon?: string, url?: string }
// Malformed/absent payloads fall back to sensible defaults rather than throwing.
// -----------------------------------------------------------------------------

interface PushPayload {
  title?: string
  body?: string
  icon?: string
  badge?: string
  url?: string
}

const DEFAULT_NOTIFICATION_TITLE = 'DerLg'
const DEFAULT_NOTIFICATION_ICON = '/icon-192.png'

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload = {}
  try {
    payload = event.data ? (event.data.json() as PushPayload) : {}
  } catch {
    // Non-JSON payload — fall back to plain text body when available.
    payload = { body: event.data?.text() }
  }

  const title = payload.title || DEFAULT_NOTIFICATION_TITLE
  const options: NotificationOptions = {
    body: payload.body,
    icon: payload.icon || DEFAULT_NOTIFICATION_ICON,
    badge: payload.badge || DEFAULT_NOTIFICATION_ICON,
    // Stash the click-through URL for the notificationclick handler.
    data: { url: payload.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const data = event.notification.data as { url?: string } | undefined
  const targetUrl = data?.url || '/'

  // Focus an existing client on the target URL, otherwise open a new window
  // (Requirement 19.5 — navigate to the relevant page on click).
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of clientList) {
        // Reuse any open app window; navigate it to the target.
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client && targetUrl) {
            try {
              await (client as WindowClient).navigate(targetUrl)
            } catch {
              // navigate can fail cross-origin; ignore and keep focus.
            }
          }
          return
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl)
      }
    })(),
  )
})
