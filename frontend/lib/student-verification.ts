/**
 * Client-side helpers for the student-discount verification flow
 * (Task 16.6 — Requirements 8.4, 35.1–35.6).
 *
 * Split into two layers (mirroring `image-upload.ts`):
 *
 * 1. A *pure*, DOM-free validation function ({@link validateDocumentFile}) and
 *    status-parsing helper ({@link parseVerificationStatus}) that the test
 *    suite can exercise directly under jsdom.
 * 2. A browser-only upload helper ({@link uploadStudentDocument}) that uses
 *    `XMLHttpRequest` for real upload progress events (which `fetch` cannot
 *    report), reusing the same approach as the avatar upload.
 *
 * ## Why a separate module from `image-upload.ts`
 *
 * The avatar flow accepts images only (JPEG/PNG/WebP) up to 5 MB and crops to a
 * 400×400 square. Student documents instead allow **PDF** (no cropping) and a
 * larger **10 MB** limit. Rather than overload the avatar validator with
 * divergent constraints, this module defines its own document validator.
 *
 * ## Backend contract (ASSUMPTION)
 *
 * At the time of writing the NestJS backend exposes **no** student-verification
 * endpoint — `users.controller.ts` only has `GET/PATCH /v1/users/me`, and the
 * only student signal surfaced is `isStudent` on the profile (mapped from
 * `isStudentVerified`). The backend *does* reserve student error codes
 * (`STD_VERIFICATION_NOT_FOUND`, `STD_ALREADY_VERIFIED`), so this is a known
 * future endpoint. Task 16.6 therefore defines the frontend contract and
 * documents the assumption:
 *
 *   `GET {NEXT_PUBLIC_API_URL}/v1/users/me/student-verification`
 *   - Auth: `Authorization: Bearer <accessToken>`
 *   - Response: `{ success, data }` envelope where `data` is
 *       `{ status: 'none'|'pending'|'approved'|'rejected', submittedAt?, reviewedAt?, rejectionReason? }`.
 *
 *   `POST {NEXT_PUBLIC_API_URL}/v1/users/me/student-verification`
 *   - Content-Type: multipart/form-data
 *   - Field name: `document` (the PDF/JPEG/PNG file)
 *   - Auth: `Authorization: Bearer <accessToken>`
 *   - Response: the same status envelope (typically `status: 'pending'`).
 *
 * Until those endpoints ship the view DEGRADES GRACEFULLY:
 * - The status GET falls back to deriving `approved`/`none` from the profile's
 *   `isStudent` flag (see {@link deriveStatusFromProfile}).
 * - A missing POST endpoint surfaces a clear inline error rather than crashing.
 */

/** Allowed MIME types for a student verification document (Requirement 35.3). */
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const
export type AllowedDocumentType = (typeof ALLOWED_DOCUMENT_TYPES)[number]

/** Maximum accepted document size: 10 MB (Requirement 35.3). */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

/** Accept attribute for the file picker / drop hint. */
export const DOCUMENT_ACCEPT_ATTR = ALLOWED_DOCUMENT_TYPES.join(',')

/**
 * Reason a document file was rejected. Maps 1:1 to an i18n key so the UI can
 * show a localized message without inspecting free-form strings.
 */
export type DocumentValidationError = 'type' | 'size' | 'empty'

export interface DocumentValidationResult {
  ok: boolean
  /** Present only when `ok` is `false`. */
  error?: DocumentValidationError
}

/**
 * Validate a candidate verification document against the allowed type set and
 * size limit (Requirement 35.3). Pure and DOM-free so it is unit-testable.
 *
 * Order matters: an empty file is reported as `empty`, an unsupported type as
 * `type` (checked before size), and an oversized file as `size`.
 *
 * @param file The user-selected file (from an `<input type=file>` or drop event).
 */
export function validateDocumentFile(file: File): DocumentValidationResult {
  if (!file || file.size === 0) {
    return { ok: false, error: 'empty' }
  }
  if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'type' }
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: 'size' }
  }
  return { ok: true }
}

/**
 * Verification status as surfaced to the UI (Requirement 35.5).
 * - `none`     — no document submitted yet.
 * - `pending`  — submitted, awaiting review.
 * - `approved` — verified student (badge shown — Requirement 35.6).
 * - `rejected` — submission was rejected; user may resubmit.
 */
export type VerificationStatus = 'none' | 'pending' | 'approved' | 'rejected'

export const VERIFICATION_STATUSES: readonly VerificationStatus[] = [
  'none',
  'pending',
  'approved',
  'rejected',
] as const

export interface StudentVerification {
  status: VerificationStatus
  /** ISO timestamp the document was submitted, when known. */
  submittedAt?: string | null
  /** ISO timestamp the submission was reviewed, when known. */
  reviewedAt?: string | null
  /** Reason supplied when `status === 'rejected'`, when provided. */
  rejectionReason?: string | null
}

function isVerificationStatus(value: unknown): value is VerificationStatus {
  return typeof value === 'string' && (VERIFICATION_STATUSES as readonly string[]).includes(value)
}

/**
 * Parse a backend verification payload, tolerant of both the
 * `{ success, data: {...} }` envelope and a bare `{ status }` body. Unknown or
 * missing status values fall back to `none`. Pure and testable.
 */
export function parseVerificationStatus(body: unknown): StudentVerification {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>
    const data = (obj.data ?? obj) as Record<string, unknown>
    if (data && typeof data === 'object') {
      const status = isVerificationStatus(data.status) ? data.status : 'none'
      return {
        status,
        submittedAt: typeof data.submittedAt === 'string' ? data.submittedAt : null,
        reviewedAt: typeof data.reviewedAt === 'string' ? data.reviewedAt : null,
        rejectionReason: typeof data.rejectionReason === 'string' ? data.rejectionReason : null,
      }
    }
  }
  return { status: 'none' }
}

/**
 * Derive a best-effort verification status from the profile's `isStudent` flag.
 * Used as a graceful fallback when the dedicated status endpoint is unavailable
 * (see module docblock): a verified student maps to `approved`, otherwise
 * `none` (we cannot distinguish `pending`/`rejected` from the flag alone).
 */
export function deriveStatusFromProfile(isStudent: boolean | undefined): VerificationStatus {
  return isStudent ? 'approved' : 'none'
}

/** Default base URL, matching the api-client default (dev backend on :3003). */
function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003'
}

/** Status endpoint (see module-level "Backend contract" note). */
export function studentVerificationStatusUrl(): string {
  return `${apiBase()}/v1/users/me/student-verification`
}

/** Document upload endpoint (see module-level "Backend contract" note). */
export function studentVerificationUploadUrl(): string {
  return `${apiBase()}/v1/users/me/student-verification`
}

export interface UploadDocumentOptions {
  /** Bearer access token to authorize the request. */
  token?: string | null
  /** Progress callback receiving an integer percentage 0–100 (Requirement 35.4). */
  onProgress?: (percent: number) => void
  /** Override the upload URL (primarily for testing). */
  url?: string
  /** Multipart field name. Defaults to `document`. */
  fieldName?: string
}

/**
 * Upload a student verification document to the backend with real progress
 * reporting (Requirement 35.4). Uses `XMLHttpRequest` because `fetch` cannot
 * report upload progress. Resolves with the parsed {@link StudentVerification}
 * status returned by the backend (typically `pending`).
 *
 * NOTE: the target endpoint is an assumption (see the module docblock). Callers
 * should treat a rejection as "verification upload unavailable" and surface a
 * clear inline error rather than crashing.
 */
export function uploadStudentDocument(
  file: File,
  opts: UploadDocumentOptions = {},
): Promise<StudentVerification> {
  const url = opts.url ?? studentVerificationUploadUrl()
  const fieldName = opts.fieldName ?? 'document'

  return new Promise<StudentVerification>((resolve, reject) => {
    const form = new FormData()
    form.append(fieldName, file, file.name)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', url, true)
    xhr.withCredentials = true
    if (opts.token) {
      xhr.setRequestHeader('Authorization', `Bearer ${opts.token}`)
    }
    // Do NOT set Content-Type — the browser sets the multipart boundary.

    if (opts.onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          opts.onProgress?.(Math.round((event.loaded / event.total) * 100))
        }
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let parsed: unknown = null
        try {
          parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null
        } catch {
          parsed = null
        }
        opts.onProgress?.(100)
        // A 2xx with an unparseable/empty body is treated as a successful
        // submission that is now pending review.
        const result = parseVerificationStatus(parsed)
        resolve(result.status === 'none' ? { status: 'pending' } : result)
      } else {
        reject(new Error(`Upload failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(new Error('Upload aborted'))

    xhr.send(form)
  })
}
