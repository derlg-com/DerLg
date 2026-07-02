import { api, ApiError } from '@/lib/api-client'
import type { ContactFormValues } from '@/schemas/contact'

/**
 * Contact / support message submission (Task 29.2 — Section 29).
 *
 * ## Backend contract (ASSUMPTION)
 *
 * At the time of writing the NestJS backend exposes **no** contact/support
 * endpoint. This module defines the assumed contract:
 *
 *   `POST {NEXT_PUBLIC_API_URL}/v1/contact`   (primary)
 *   `POST {NEXT_PUBLIC_API_URL}/v1/support/messages`  (accepted alias)
 *   - JSON body: `{ name, email, subject, message }`
 *   - When an attachment is present, the request is sent as
 *     `multipart/form-data` with the fields above plus a `file` part.
 *   - Auth: optional (the form is reachable by guests). The shared api-client
 *     attaches a Bearer token automatically when the user is signed in.
 *   - Response: standard `{ success, data, message, error }` envelope. Field
 *     errors (if any) are returned as `error.details` keyed by field name.
 *
 * Until the endpoint ships the call will 404; callers degrade gracefully (show
 * a success toast for the *assumed* happy path is NOT done here — the caller
 * decides). This module surfaces a typed result so the UI can map field errors
 * and never crash.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003'

/** Endpoint path the contact form submits to (documented assumption). */
export const CONTACT_ENDPOINT = '/v1/contact'

export interface SubmitContactInput extends ContactFormValues {
  /** Optional single attachment (validated by the caller before submit). */
  attachment?: File | null
}

/** Per-field validation errors mapped back from the backend, if provided. */
export type ContactFieldErrors = Partial<Record<keyof ContactFormValues, string>>

export interface SubmitContactResult {
  ok: boolean
  /** Field-level errors to surface next to inputs (best-effort). */
  fieldErrors?: ContactFieldErrors
  /** `true` when the failure was because the endpoint does not exist yet (404). */
  notImplemented?: boolean
}

/** Extract best-effort field errors from an {@link ApiError}'s details. */
function extractFieldErrors(err: ApiError): ContactFieldErrors | undefined {
  const details = err.details
  if (!details || typeof details !== 'object') return undefined
  const out: ContactFieldErrors = {}
  for (const key of ['name', 'email', 'subject', 'message'] as const) {
    const value = (details as Record<string, unknown>)[key]
    if (typeof value === 'string') out[key] = value
    else if (Array.isArray(value) && typeof value[0] === 'string') out[key] = value[0] as string
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Submit a contact/support message. Uses the typed `api` client for the JSON
 * path, and a raw `fetch` with `FormData` when an attachment is present (so the
 * browser sets the multipart boundary). Never throws — returns a typed result.
 */
export async function submitContactMessage(
  input: SubmitContactInput,
): Promise<SubmitContactResult> {
  const { attachment, ...fields } = input

  try {
    if (attachment) {
      const form = new FormData()
      form.append('name', fields.name)
      form.append('email', fields.email)
      form.append('subject', fields.subject)
      form.append('message', fields.message)
      form.append('file', attachment, attachment.name)

      const res = await fetch(`${API_URL}${CONTACT_ENDPOINT}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
        // No Content-Type header — the browser sets the multipart boundary.
      })
      if (!res.ok) {
        return { ok: false, notImplemented: res.status === 404 }
      }
      return { ok: true }
    }

    await api.post(CONTACT_ENDPOINT, fields, { auth: true, retries: 0 })
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        ok: false,
        fieldErrors: extractFieldErrors(err),
        notImplemented: err.status === 404,
      }
    }
    // Network / unexpected error.
    return { ok: false }
  }
}
