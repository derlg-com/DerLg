/**
 * Client-side profile-picture processing for the avatar upload flow
 * (Task 16.3 — Requirements 8.9, 29.1–29.5, 29.7).
 *
 * This module is split into two layers:
 *
 * 1. A *pure*, DOM-free validation function ({@link validateImageFile}) that the
 *    test suite can exercise directly under jsdom without touching `<canvas>`.
 * 2. Browser-only helpers ({@link cropToSquare}, {@link uploadAvatar}) that use
 *    native canvas / `XMLHttpRequest`. We deliberately avoid a heavy image
 *    dependency: the browser's own `<canvas>` 2D context handles center-crop +
 *    resize + re-encode, and `XMLHttpRequest` gives real upload progress events
 *    (which `fetch` cannot report).
 *
 * ## Backend upload contract (ASSUMPTION)
 *
 * At the time of writing the NestJS backend exposes **no** avatar-upload
 * endpoint — `users.service.ts` only persists a plain `avatarUrl` string (set,
 * for example, by the Google OAuth callback). Task 16.3 therefore defines the
 * frontend contract and documents the assumption:
 *
 *   `POST {NEXT_PUBLIC_API_URL}/v1/users/me/avatar`
 *   - Content-Type: multipart/form-data
 *   - Field name: `file` (the processed 400×400 image blob)
 *   - Auth: `Authorization: Bearer <accessToken>` (same token the api-client sends)
 *   - Response: the standard `{ success, data }` envelope where
 *       `data` is `{ avatarUrl: string }` (or a bare `{ avatarUrl }` body).
 *
 * Until that endpoint ships the upload call will fail; the {@link AvatarUpload}
 * component degrades gracefully — it still produces the cropped preview and the
 * existing "Avatar URL" text flow continues to work, and an upload failure is
 * surfaced as an inline error rather than crashing the form.
 */

/** Allowed MIME types for a profile picture (Requirement 29.2). */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

/** Maximum accepted upload size: 5 MB (Requirement 29.3). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Output dimension for the cropped square avatar (Requirement 29.5). */
export const AVATAR_SIZE_PX = 400

/** Quality used when re-encoding the cropped image (0–1). */
export const COMPRESSION_QUALITY = 0.82

/**
 * Reason an image file was rejected. Maps 1:1 to an i18n key so the UI can show
 * a localized message without inspecting free-form strings.
 */
export type ImageValidationError = 'type' | 'size' | 'empty'

export interface ImageValidationResult {
  ok: boolean
  /** Present only when `ok` is `false`. */
  error?: ImageValidationError
}

/**
 * Validate a candidate profile picture against the allowed type set and size
 * limit (Requirements 29.2, 29.3). Pure and DOM-free so it is unit-testable.
 *
 * @param file The user-selected file (from an `<input type=file>` or drop event).
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (!file || file.size === 0) {
    return { ok: false, error: 'empty' }
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'type' }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'size' }
  }
  return { ok: true }
}

/** Human-readable list of accepted extensions for hint text / the file picker. */
export const ACCEPT_ATTR = ALLOWED_IMAGE_TYPES.join(',')

/**
 * Compute the largest centered square (in source pixels) that fits within the
 * given image dimensions. Pure helper extracted so the geometry is testable
 * independently of the canvas. Returns the source crop rectangle.
 */
export function computeCenterSquare(
  width: number,
  height: number,
): { sx: number; sy: number; size: number } {
  const size = Math.min(width, height)
  const sx = Math.floor((width - size) / 2)
  const sy = Math.floor((height - size) / 2)
  return { sx, sy, size }
}

/**
 * Load a `File`/`Blob` into an `HTMLImageElement`. Browser-only.
 */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to decode image'))
    }
    img.src = url
  })
}

export interface CropResult {
  /** Re-encoded square image, ready to upload. */
  blob: Blob
  /** Object URL for previewing the result. Caller must revoke when done. */
  previewUrl: string
}

/**
 * Center-crop an image to a square and resize it to {@link AVATAR_SIZE_PX} px,
 * re-encoding as a compressed image (Requirements 29.4, 29.5). Browser-only —
 * relies on `<canvas>`, so it is not exercised under jsdom.
 *
 * @param file Source image (already validated by {@link validateImageFile}).
 * @param size Output edge length in px (defaults to 400).
 * @param quality Re-encode quality 0–1 (defaults to {@link COMPRESSION_QUALITY}).
 */
export async function cropToSquare(
  file: Blob,
  size: number = AVATAR_SIZE_PX,
  quality: number = COMPRESSION_QUALITY,
): Promise<CropResult> {
  const img = await loadImage(file)
  const { sx, sy, size: srcSize } = computeCenterSquare(img.naturalWidth, img.naturalHeight)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  // Draw the centered source square scaled into the square output canvas.
  ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size)

  // Prefer WebP when the source was WebP, otherwise emit JPEG for broad support.
  const outputType =
    file instanceof File && file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
      outputType,
      quality,
    )
  })

  return { blob, previewUrl: URL.createObjectURL(blob) }
}

/** Default upload endpoint (see module-level "Backend upload contract" note). */
export function avatarUploadUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003'
  return `${base}/v1/users/me/avatar`
}

export interface UploadAvatarOptions {
  /** Bearer access token to authorize the request. */
  token?: string | null
  /** Progress callback receiving an integer percentage 0–100 (Requirement 29.7). */
  onProgress?: (percent: number) => void
  /** Override the upload URL (primarily for testing). */
  url?: string
  /** Multipart field name. Defaults to `file`. */
  fieldName?: string
}

/**
 * Extract the new `avatarUrl` from the backend response, tolerant of both the
 * `{ success, data: { avatarUrl } }` envelope and a bare `{ avatarUrl }` body.
 * Pure and testable.
 */
export function parseAvatarUrl(body: unknown): string | null {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>
    const data = (obj.data ?? obj) as Record<string, unknown>
    if (data && typeof data.avatarUrl === 'string') return data.avatarUrl
  }
  return null
}

/**
 * Upload a processed avatar blob to the backend with real progress reporting
 * (Requirement 29.7). Uses `XMLHttpRequest` because `fetch` cannot report
 * upload progress. Resolves with the new `avatarUrl` returned by the backend.
 *
 * NOTE: the target endpoint is an assumption (see the module docblock). Callers
 * should treat a rejection as "upload unavailable" and fall back to the
 * existing avatar-URL text flow.
 */
export function uploadAvatar(blob: Blob, opts: UploadAvatarOptions = {}): Promise<string> {
  const url = opts.url ?? avatarUploadUrl()
  const fieldName = opts.fieldName ?? 'file'

  return new Promise<string>((resolve, reject) => {
    const form = new FormData()
    form.append(fieldName, blob, 'avatar.jpg')

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
        const avatarUrl = parseAvatarUrl(parsed)
        if (avatarUrl) {
          opts.onProgress?.(100)
          resolve(avatarUrl)
        } else {
          reject(new Error('Upload succeeded but no avatarUrl was returned'))
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(new Error('Upload aborted'))

    xhr.send(form)
  })
}

// =============================================================================
// REVIEW PHOTO UPLOAD (Task 20.3 — Requirement 21.5, 29.8)
// =============================================================================

/**
 * Default review-photo upload endpoint.
 *
 * ## Backend upload contract (ASSUMPTION)
 *
 * Mirrors the avatar-upload assumption above — no backend reviews module exists
 * yet (see `lib/reviews-api.ts`). The frontend defines the contract:
 *
 *   `POST {NEXT_PUBLIC_API_URL}/v1/reviews/photos`
 *   - Content-Type: multipart/form-data
 *   - Field name: `file`
 *   - Auth: `Authorization: Bearer <accessToken>`
 *   - Response: `{ success, data: { url: string } }` (or a bare `{ url }`).
 *
 * Until that endpoint ships the call rejects and the {@link ReviewForm}
 * degrades gracefully — surfacing an inline error instead of crashing — while
 * the rest of the review submission flow (rating + text) keeps working.
 */
export function reviewPhotoUploadUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003'
  return `${base}/v1/reviews/photos`
}

/**
 * Extract the uploaded photo `url` from the backend response, tolerant of both
 * the `{ success, data: { url } }` envelope and a bare `{ url }` body. Also
 * accepts `{ avatarUrl }`/`{ imageUrl }` aliases for resilience. Pure/testable.
 */
export function parseUploadedUrl(body: unknown): string | null {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>
    const data = (obj.data ?? obj) as Record<string, unknown>
    for (const key of ['url', 'imageUrl', 'avatarUrl']) {
      if (data && typeof data[key] === 'string') return data[key] as string
    }
  }
  return null
}

export interface UploadReviewPhotoOptions {
  /** Bearer access token to authorize the request. */
  token?: string | null
  /** Progress callback receiving an integer percentage 0–100. */
  onProgress?: (percent: number) => void
  /** Override the upload URL (primarily for testing). */
  url?: string
  /** Multipart field name. Defaults to `file`. */
  fieldName?: string
}

/**
 * Upload a single review photo (already validated by {@link validateImageFile})
 * to the backend with progress reporting (Requirement 21.5). Reuses the
 * `XMLHttpRequest` upload pattern from {@link uploadAvatar}. Resolves with the
 * stored photo URL. Callers should treat a rejection as "upload unavailable".
 */
export function uploadReviewPhoto(
  file: Blob,
  opts: UploadReviewPhotoOptions = {},
): Promise<string> {
  const url = opts.url ?? reviewPhotoUploadUrl()
  const fieldName = opts.fieldName ?? 'file'

  return new Promise<string>((resolve, reject) => {
    const form = new FormData()
    const name = file instanceof File ? file.name : 'photo.jpg'
    form.append(fieldName, file, name)

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
        const uploaded = parseUploadedUrl(parsed)
        if (uploaded) {
          opts.onProgress?.(100)
          resolve(uploaded)
        } else {
          reject(new Error('Upload succeeded but no url was returned'))
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(new Error('Upload aborted'))

    xhr.send(form)
  })
}
