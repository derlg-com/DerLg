import { api } from './api-client'

/**
 * GDPR data-export client (Section 32.3 — Requirement 50.6, 50.7).
 *
 * ## Backend contract (ASSUMPTION — endpoint may not exist yet)
 *
 * `GET /v1/users/me/export` is assumed to return the authenticated user's
 * personal data as a JSON payload (the `data` of the standard envelope). The
 * backend `UsersController` currently exposes `GET`/`PATCH /v1/users/me` only,
 * so this endpoint must be added server-side. The UI DEGRADES GRACEFULLY: if
 * the call fails, the caller surfaces a friendly error instead of crashing.
 *
 * Account deletion is handled separately by {@link import('@/hooks/use-delete-account')}.
 */

/** Fetch the current user's exportable personal data (Requirement 50.6). */
export function requestDataExport() {
  // `retries: 0` — don't hammer an endpoint that likely doesn't exist yet.
  return api.get<unknown>('/v1/users/me/export', { retries: 0 })
}

/**
 * Trigger a client-side download of arbitrary JSON data as a file. SSR-safe:
 * no-ops when `document` is unavailable. Used to deliver the data export
 * without a server round-trip for file generation.
 */
export function downloadJson(data: unknown, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
