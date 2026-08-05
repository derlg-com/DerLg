import {
  ApiError,
  NetworkError,
  TimeoutError,
  type ApiEnvelope,
  type Paginated,
} from './errors'

import { toAcceptLanguage, type Locale } from '@/lib/i18n/config'

/**
 * Typed client for the NestJS backend at /v1.
 *
 * Two backend behaviours shape this design:
 *
 *  - `ValidationPipe` runs with `forbidNonWhitelisted: true`, so sending a query
 *    or body field the DTO does not declare returns 400. `buildQuery` therefore
 *    drops undefined/null/empty values rather than serialising them.
 *  - Every response is wrapped in an envelope. `request` unwraps it so callers
 *    get `T` directly and never touch `success`.
 */

const DEFAULT_TIMEOUT_MS = 15_000

/** Server-side requests may need a different host than the browser (e.g. Docker). */
function baseUrl(): string {
  const internal = typeof window === 'undefined' ? process.env.API_INTERNAL_URL : undefined
  const url = internal || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003'
  return `${url.replace(/\/$/, '')}/v1`
}

export type QueryValue = string | number | boolean | undefined | null

/**
 * Serialises a query object, omitting anything the backend would reject or that
 * carries no meaning. Empty strings are dropped because a cleared filter input
 * should mean "no filter", not "match the empty string".
 */
export function buildQuery(params: Record<string, QueryValue> = {}): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    search.set(key, String(value))
  }

  const serialised = search.toString()
  return serialised ? `?${serialised}` : ''
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  /** Query params; undefined/null/empty entries are omitted. */
  query?: Record<string, QueryValue>
  /** JSON body. Serialised as-is, so callers must not include unknown fields. */
  body?: unknown
  /** Drives the `Accept-Language` header, which localises backend content. */
  locale?: Locale
  /** Bearer token for authenticated endpoints. */
  token?: string | null
  /** Required by the backend to make booking creation safely retryable. */
  idempotencyKey?: string
  signal?: AbortSignal
  timeoutMs?: number
  /** Extra headers; used by the BFF to forward the service key server-side. */
  headers?: Record<string, string>
  /** Include credentials so the refresh cookie is sent. Defaults to true. */
  credentials?: RequestCredentials
  /** Next.js fetch cache options for server components. */
  cache?: RequestCache
  next?: { revalidate?: number | false; tags?: string[] }
}

function normaliseMessages(message: string | string[] | undefined, fallback: string): string[] {
  if (Array.isArray(message)) return message.length > 0 ? message : [fallback]
  if (typeof message === 'string' && message.trim() !== '') return [message]
  return [fallback]
}

/**
 * Performs a request and unwraps the envelope.
 *
 * Throws `ApiError` (or `NetworkError`/`TimeoutError`) on failure so React Query
 * and error boundaries see a rejected promise with a typed cause.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    query,
    body,
    locale,
    token,
    idempotencyKey,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers: extraHeaders,
    credentials = 'include',
    cache,
    next,
  } = options

  const url = `${baseUrl()}/${path.replace(/^\//, '')}${buildQuery(query)}`

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extraHeaders,
  }
  if (locale) headers['Accept-Language'] = toAcceptLanguage(locale)
  if (token) headers.Authorization = `Bearer ${token}`
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  // Own timeout, combined with any caller-supplied signal.
  const timeoutController = new AbortController()
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs)
  const signals = [timeoutController.signal, signal].filter(Boolean) as AbortSignal[]
  const combinedSignal =
    signals.length > 1 ? AbortSignal.any(signals) : (signals[0] as AbortSignal | undefined)

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: combinedSignal,
      credentials,
      ...(cache ? { cache } : {}),
      ...(next ? { next } : {}),
    })
  } catch (error) {
    clearTimeout(timer)
    // Distinguish "caller cancelled" from "we timed out" from "network down".
    if (signal?.aborted) throw new TimeoutError('The request was cancelled')
    if (timeoutController.signal.aborted) throw new TimeoutError()
    throw new NetworkError(error instanceof Error ? error.message : 'Network request failed')
  } finally {
    clearTimeout(timer)
  }

  // 204 and other empty bodies are valid successes (e.g. logout).
  if (response.status === 204) return undefined as T

  const text = await response.text()
  if (text === '') {
    if (response.ok) return undefined as T
    throw new ApiError({
      status: response.status,
      code: 'INTERNAL_ERROR',
      messages: [response.statusText || 'Request failed'],
    })
  }

  let envelope: ApiEnvelope<T>
  try {
    envelope = JSON.parse(text) as ApiEnvelope<T>
  } catch {
    // A non-JSON body means something other than the API answered (proxy, HTML
    // error page). Surface it as a network-level failure, not a parse crash.
    throw new NetworkError(`Expected JSON from ${path} but received a non-JSON response`)
  }

  if (!response.ok || envelope.success === false) {
    const failure = envelope as { error?: { code?: string; message?: string | string[] } }
    throw new ApiError({
      status: response.status,
      code: failure.error?.code ?? 'INTERNAL_ERROR',
      messages: normaliseMessages(failure.error?.message, response.statusText || 'Request failed'),
    })
  }

  return envelope.data
}

/** Convenience wrapper for list endpoints, whose `data` is a `Paginated<T>`. */
export function requestList<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Paginated<T>> {
  return request<Paginated<T>>(path, options)
}

export const api = {
  get: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'GET' }),

  list: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    requestList<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method'> = {}) =>
    request<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method'> = {}) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'DELETE' }),
}
