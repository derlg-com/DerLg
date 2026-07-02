import type { Metadata } from 'next'
import { OfflineFallback } from '@/components/shared/OfflineFallback'

/**
 * Custom offline fallback page (task 19.3, Requirement 12.8).
 *
 * Serwist precaches this route at build time (`precachePrerendered: true` in
 * serwist.config.mjs) and the service worker's navigation fallback (see
 * `app/sw.ts`) serves it whenever the user navigates to a route that is not in
 * the cache while offline. Without this page such a navigation would show the
 * browser's generic "no internet" error instead of an on-brand screen.
 *
 * The `~offline` segment name follows Serwist's documented convention for the
 * offline document and keeps it out of normal navigation.
 */
export const metadata: Metadata = {
  title: 'Offline — DerLg',
}

// Static so it is prerendered into the precache manifest.
export const dynamic = 'force-static'

export default function OfflinePage() {
  return <OfflineFallback />
}
