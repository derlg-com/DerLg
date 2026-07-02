import { v4 as uuid } from 'uuid'

/**
 * Typed `fetch` wrapper for the DerLg NestJS backend.
 *
 * Responsibilities:
 * - Prefix requests with `NEXT_PUBLIC_API_URL` (defaults to the dev backend on :3003).
 * - Send the refresh cookie via `credentials: 'include'`.
 * - Inject the in-memory access token as `Authorization: Bearer …`.
 * - Unwrap the backend's `{ success, data }` envelope (tolerant of raw bodies).
 * - Normalize errors into a typed {@link ApiError}.
 * - On `401`, refresh the access token once (single-flight) and retry the request.
 * - Attach an `Idempotency-Key` header to mutating calls when requested.
 * - Apply a per-request timeout (default 30s) via `AbortController`.
 * - Retry transient failures (network errors / 5xx) with exponential backoff.
 *
 * The access token lives in module memory (never localStorage). The Zustand
 * auth store is the source of truth and mirrors the token here via
 * {@link setAccessToken}; this module owns the value the client actually sends.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003'

/** Default request timeout (ms). Requirement 15.7. */
const DEFAULT_TIMEOUT_MS = 30_000
/** Default number of retries for transient failures. Requirement 15.9. */
const DEFAULT_RETRIES = 2
/** Base delay (ms) for exponential backoff between retries. */
const RETRY_BASE_DELAY_MS = 300

let accessToken: string | null = null
let onAuthError: (() => void) | null = null
let refreshPromise: Promise<string | null> | null = null
let acceptLanguage: string | null = null

/** Current in-memory access token, or `null` when unauthenticated. */
export function getAccessToken(): string | null {
  return accessToken
}

/**
 * Set the `Accept-Language` the client sends on every request, so the backend
 * returns localized catalog content (trip/place/hotel/guide names and
 * descriptions) for the active UI language (Requirement 13.7). The backend
 * resolves locale from this header for both list and detail endpoints.
 *
 * Pass the active {@link Locale} tag (`en` | `zh` | `km`) or `null` to clear.
 * Bridged from the Zustand language store (see `LanguageSync`).
 */
export function setAcceptLanguage(locale: string | null): void {
  acceptLanguage = locale
}

/** Current `Accept-Language` value the client sends, or `null` when unset. */
export function getAcceptLanguage(): string | null {
  return acceptLanguage
}

/** Set (or clear) the access token the client attaches to authenticated calls. */
export function setAccessToken(token: string | null): void {
  accessToken = token
}

/** Clear the in-memory access token. */
export function clearAccessToken(): void {
  accessToken = null
}

/**
 * Register a callback fired when a 401 cannot be recovered by refresh
 * (i.e. the session is truly gone). The app wires this to redirect to /login.
 */
export function setAuthErrorHandler(fn: (() => void) | null): void {
  onAuthError = fn
}

/** Normalized API error carrying the backend error code and HTTP status. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: unknown

  constructor(params: { code: string; message: string; status: number; details?: unknown }) {
    super(params.message)
    this.name = 'ApiError'
    this.code = params.code
    this.status = params.status
    this.details = params.details
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  /** Attach an `Idempotency-Key`. Pass `true` to auto-generate a uuid, or a fixed string. */
  idempotencyKey?: string | boolean
  /** When `false`, skip Bearer injection and the 401→refresh→retry flow (e.g. login). */
  auth?: boolean
  signal?: AbortSignal
  /**
   * Per-request timeout in milliseconds. Defaults to 30s (Requirement 15.7).
   * Pass `0` to disable the timeout. The timeout is combined with any caller
   * `signal`: whichever aborts first wins.
   */
  timeoutMs?: number
  /**
   * Number of retry attempts for transient failures (network errors and 5xx
   * responses) using exponential backoff (Requirement 15.9). Defaults to 2.
   * Pass `0` to disable retries. Caller-initiated aborts are never retried.
   */
  retries?: number
  /** @internal — marks the single allowed retry after a token refresh. */
  _retry?: boolean
}

/** Thrown when a request exceeds its configured timeout. */
export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`)
    this.name = 'TimeoutError'
  }
}

function buildHeaders(opts: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers ?? {}),
  }
  if (opts.auth !== false && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }
  // Localize catalog responses for the active UI language (Requirement 13.7),
  // unless the caller already set the header explicitly.
  if (acceptLanguage && !('Accept-Language' in headers)) {
    headers['Accept-Language'] = acceptLanguage
  }
  if (opts.idempotencyKey) {
    headers['Idempotency-Key'] =
      typeof opts.idempotencyKey === 'string' ? opts.idempotencyKey : uuid()
  }
  return headers
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function isEnvelope(body: unknown): body is { success: boolean; data?: unknown; error?: unknown } {
  return body !== null && typeof body === 'object' && 'success' in body
}

/** Unwrap the `{ success, data }` envelope, or return the body unchanged. */
function unwrap<T>(body: unknown): T {
  if (isEnvelope(body)) {
    return (body as { data: T }).data
  }
  return body as T
}

function toApiError(status: number, body: unknown): ApiError {
  const b = body as
    | { error?: { code?: string; message?: string; details?: unknown }; message?: string }
    | null
    | undefined
  const message =
    b?.error?.message ?? b?.message ?? (status ? `Request failed (${status})` : 'Request failed')
  const code = b?.error?.code ?? `HTTP_${status}`
  return new ApiError({ code, message, status, details: b?.error?.details })
}

/** Single-flight refresh: concurrent 401s share one `/v1/auth/refresh` call. */
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
        if (!res.ok) return null
        const text = await res.text()
        const data = unwrap<{ accessToken?: string }>(text ? safeJsonParse(text) : null)
        accessToken = data?.accessToken ?? null
        return accessToken
      } catch {
        return null
      }
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

/** `true` when the abort came from the caller's signal (not our timeout). */
function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** Sleep helper for backoff between retries. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Run a single `fetch` with a timeout (Requirement 15.7). Combines the caller's
 * `signal` with an internal timeout controller so either can abort the request.
 * Throws {@link TimeoutError} on timeout and rethrows caller aborts unchanged.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<Response> {
  if (timeoutMs <= 0) {
    return fetch(url, { ...init, signal: callerSignal })
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const onCallerAbort = () => controller.abort()
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort()
    else callerSignal.addEventListener('abort', onCallerAbort, { once: true })
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (timedOut) throw new TimeoutError(timeoutMs)
    throw err
  } finally {
    clearTimeout(timer)
    callerSignal?.removeEventListener('abort', onCallerAbort)
  }
}

/** Core request primitive. Prefer the {@link api} verb helpers. */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = opts.retries ?? DEFAULT_RETRIES

  const init: RequestInit = {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers: buildHeaders(opts),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }

  // Retry transient failures (network errors + 5xx) with exponential backoff.
  let res: Response
  let attempt = 0
  for (;;) {
    try {
      res = await fetchWithTimeout(url, init, opts.signal, timeoutMs)
    } catch (err) {
      // Caller-initiated aborts are intentional — never retry them.
      if (isAbortError(err)) throw err
      // Network error or timeout: retry with backoff if attempts remain.
      if (attempt < maxRetries) {
        await delay(RETRY_BASE_DELAY_MS * 2 ** attempt)
        attempt += 1
        continue
      }
      throw err
    }

    // Retry server errors (5xx) which are typically transient.
    if (res.status >= 500 && attempt < maxRetries) {
      await delay(RETRY_BASE_DELAY_MS * 2 ** attempt)
      attempt += 1
      continue
    }
    break
  }

  if (res.status === 401 && opts.auth !== false && !opts._retry) {
    const hadToken = accessToken !== null
    const newToken = await refreshAccessToken()
    if (newToken) {
      return request<T>(path, { ...opts, _retry: true })
    }
    if (hadToken) {
      clearAccessToken()
      onAuthError?.()
    }
  }

  const text = await res.text()
  const body = text ? safeJsonParse(text) : null

  if (!res.ok || (isEnvelope(body) && body.success === false)) {
    throw toApiError(res.status, body)
  }
  return unwrap<T>(body)
}

/** Convenience verb helpers around {@link request}. */
export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
}

/** Build a `/v1/...` query string from a params object, omitting empty values. */
export function buildQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      for (const v of value)
        if (v !== undefined && v !== null && v !== '') sp.append(key, String(v))
    } else {
      sp.append(key, String(value))
    }
  }
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}
