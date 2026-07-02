import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

/**
 * XML sitemap (Task 30.3 — Section 30 SEO).
 *
 * Lists the public, indexable routes of the app. Authenticated/transactional
 * areas (profile, checkout, bookings) and the auth group are intentionally
 * excluded — they are also disallowed in `app/robots.ts`.
 *
 * ## Dynamic entries
 *
 * Per-entity URLs (`/trips/[id]`, `/hotels/[id]`, `/guides/[id]`,
 * `/festivals/[id]`) are NOT enumerated here. Fetching the full catalog at
 * build/runtime is risky (the backend may be unavailable during build, and the
 * lists are unbounded), so we ship the stable static + listing routes only.
 *
 * To add dynamic entries later: fetch the public id lists from the backend
 * (e.g. `GET /v1/trips?fields=id`) inside this async function and map each id
 * to `{ url: `${base}/trips/${id}`, ... }`, wrapped in try/catch so a backend
 * outage degrades gracefully to the static list below.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const now = new Date()

  const staticRoutes: Array<{
    path: string
    priority: number
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  }> = [
    { path: '/', priority: 1.0, changeFrequency: 'daily' },
    { path: '/explore', priority: 0.9, changeFrequency: 'daily' },
    { path: '/trips', priority: 0.9, changeFrequency: 'daily' },
    { path: '/hotels', priority: 0.8, changeFrequency: 'daily' },
    { path: '/guides', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/transportation', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/festivals', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/search', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.4, changeFrequency: 'monthly' },
  ]

  return staticRoutes.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
