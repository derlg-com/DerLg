/**
 * URL safety for values that arrive from the AI agent.
 *
 * The agent is a separate service whose tool results are shaped by an LLM and by
 * upstream APIs, so any URL it hands us is untrusted input. Rendering one straight
 * into `<a href>` is a script-execution vector: `javascript:` and `data:text/html`
 * URLs run when the link is clicked, so the whole chat would be one click from XSS.
 *
 * ## Absolute only, on purpose
 *
 * Every URL the agent legitimately produces is absolute — a MinIO object, a Stripe
 * receipt, a provider QR image. Nothing it sends should be a relative path, so
 * relative input is refused outright rather than resolved.
 *
 * That is not just tidiness. Resolving relative input is where the subtle bugs
 * live: WHATWG URL parsing treats a backslash as a slash in path-or-authority
 * state, so `/\evil.com` and `/\/evil.com` READ as paths and RESOLVE to another
 * origin. Refusing the whole category removes that class of bug instead of playing
 * whack-a-mole with it. The app's own internal links are written as literals
 * through `Link`, and never go through here.
 *
 * `<img src>` does NOT execute script for these schemes in any current browser, so
 * images get the looser `safeImageSrc` — but it is still an allowlist, because this
 * module is exported and a future caller may use a value somewhere that does.
 */

/** Removes characters URL parsers discard before resolving a scheme or authority. */
function stripControls(value: string): string {
  let out = ''
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    // C0 controls, DEL and C1 are all ignored, so `java\tscript:` is `javascript:`.
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) continue
    out += char
  }
  return out
}

/**
 * Returns the URL only if it is safe in an `href`, otherwise null.
 *
 * Safe means: parses as an absolute URL whose scheme is exactly http or https.
 * Everything else — relative paths, protocol-relative, `javascript:`, `data:`,
 * `blob:`, `file:`, custom app schemes, unparseable junk — is refused.
 */
export function safeHref(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = stripControls(value).trim()
  if (trimmed === '') return null

  let url: URL
  try {
    // No base: a relative value throws here, which is the intended rejection.
    url = new URL(trimmed)
  } catch {
    return null
  }

  // An allowlist, not a denylist: an unknown scheme is refused by default.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  return url.toString()
}

/**
 * Media types accepted as an inline image.
 *
 * SVG is deliberately absent: it can carry script. An `<img>` will not execute it,
 * but this helper is exported and a caller using `<object>`, `<embed>` or a
 * navigation would. Raster formats have no such escape hatch.
 */
const INLINE_IMAGE_TYPES =
  /^data:image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)[;,]/

/**
 * Returns the URL only if it is usable as an image source, otherwise null.
 *
 * Adds inline raster images to `safeHref`'s rule, because the backend mints
 * payment QR codes as `data:image/png` URIs.
 */
export function safeImageSrc(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = stripControls(value).trim()
  if (trimmed === '') return null

  if (trimmed.toLowerCase().startsWith('data:')) {
    return INLINE_IMAGE_TYPES.test(trimmed.toLowerCase()) ? trimmed : null
  }

  return safeHref(trimmed)
}

/**
 * Normalizes an image source for safe and reliable browser rendering.
 *
 * First validates the URL via `safeImageSrc`. If the URL points to the local
 * development MinIO store (`http://localhost:9000/derlg-storage/...` or
 * `http://127.0.0.1:9000/derlg-storage/...`), rewrites it to `/derlg-storage/...`.
 * This allows mobile devices on LAN (e.g. `http://10.89.106.160:3002`) and external
 * browser clients to load images without hitting port 9000 on their own local device.
 */
export function normalizeImageUrl(value: unknown): string | null {
  const safe = safeImageSrc(value)
  if (!safe) return null

  if (
    safe.startsWith('http://localhost:9000/derlg-storage/') ||
    safe.startsWith('http://127.0.0.1:9000/derlg-storage/')
  ) {
    try {
      const parsed = new URL(safe)
      return parsed.pathname + parsed.search
    } catch {
      return safe
    }
  }

  return safe
}

