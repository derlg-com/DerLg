/**
 * Canonical site origin helper (Tasks 30.2, 30.3 — SEO sitemap / canonical /
 * structured-data URLs).
 *
 * The absolute, user-facing origin of the deployed app is needed in several
 * SEO-related places that run on the server (`app/sitemap.ts`, `app/robots.ts`,
 * JSON-LD builders). Those contexts cannot read the request host reliably at
 * build time, so the origin is configured via env.
 *
 * Resolution order:
 *  1. `NEXT_PUBLIC_SITE_URL` — the explicit, canonical production origin
 *     (e.g. `https://derlg.com`). Prefer this in production.
 *  2. `NEXT_PUBLIC_APP_URL` — the existing app origin env already used by
 *     `lib/og-metadata.ts`; reused as a fallback so we don't require a new env
 *     var just to build.
 *  3. `http://localhost:3000` — sensible dev default.
 *
 * The returned value never has a trailing slash, so callers can safely do
 * `${siteUrl()}${path}`.
 */
const FALLBACK_ORIGIN = 'http://localhost:3000'

/** Strip a single trailing slash (but keep the scheme's `//`). */
function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

/**
 * The canonical site origin, without a trailing slash. Reads
 * `NEXT_PUBLIC_SITE_URL` → `NEXT_PUBLIC_APP_URL` → localhost.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? FALLBACK_ORIGIN
  return trimTrailingSlash(raw)
}

/**
 * Build an absolute URL for an app-relative `path` (e.g. `/trips/123`).
 * Idempotent for values that are already absolute (`http(s)://…`).
 */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = siteUrl()
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}
