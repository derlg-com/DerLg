/**
 * Server-only access to the service-key-protected `/v1/ai-tools/*` endpoints.
 *
 * The backend exposes festivals, weather, emergency contacts, budget estimates,
 * loyalty and payment QR/status ONLY behind `ServiceKeyGuard`, which expects an
 * `x-service-key` header. That key must never reach the browser, so every such
 * call is proxied through this module from a route handler.
 *
 * This file has no 'use client' directive and reads `process.env.AI_SERVICE_KEY`,
 * so importing it from a client component is a build error — which is the
 * intended guard rail.
 */
import { ApiError, NetworkError } from '@/lib/api/errors'

/** Paths the browser may reach, and how. */
export const BFF_ROUTES = {
  festivals: { path: 'ai-tools/festivals', method: 'GET', auth: 'public' },
  weather: { path: 'ai-tools/weather', method: 'GET', auth: 'public' },
  'emergency-contacts': { path: 'ai-tools/emergency-contacts', method: 'GET', auth: 'public' },
  places: { path: 'ai-tools/places', method: 'GET', auth: 'public' },
  'budget/estimate': { path: 'ai-tools/budget/estimate', method: 'POST', auth: 'public' },

  /*
   * These identify a user. The `user_id` is taken from the verified JWT and any
   * client-supplied value is discarded — otherwise anyone could read another
   * user's loyalty balance or raise an SOS in their name.
   */
  loyalty: { path: 'ai-tools/loyalty', method: 'GET', auth: 'user' },
  sos: { path: 'ai-tools/sos', method: 'POST', auth: 'user' },
} as const

export type BffRouteKey = keyof typeof BFF_ROUTES

export function isBffRoute(key: string): key is BffRouteKey {
  return Object.prototype.hasOwnProperty.call(BFF_ROUTES, key)
}

/**
 * Endpoints deliberately NOT proxied, with the reason. Kept as documentation so
 * a future change has to think about it rather than just adding a line above.
 *
 *  - ai-tools/bookings        creates a real 15-minute hold; the browser must use
 *                             the authenticated /v1/{trips,hotels,...}/bookings
 *                             routes so ownership is enforced by JWT.
 *  - ai-tools/search/*        duplicates the public catalogue endpoints.
 *  - ai-tools/availability    duplicates the public availability endpoints.
 *  - ai-tools/payments/qr     generates a payable QR; only the agent should mint
 *                             these, against a hold it created.
 *  - ai-tools/payments/status superseded by the first-class GET /v1/payments/status,
 *                             which the browser calls directly with the user's JWT
 *                             (see lib/api/payments.ts + hooks/use-payment-status.ts).
 *                             Proxying it behind the service key only widened the
 *                             surface; the first-class endpoint already scopes the
 *                             record to the JWT subject.
 */
export const BFF_EXCLUDED = [
  'ai-tools/bookings',
  'ai-tools/search/trips',
  'ai-tools/search/transport',
  'ai-tools/hotels',
  'ai-tools/guides',
  'ai-tools/availability',
  'ai-tools/payments/qr',
  'ai-tools/payments/status',
] as const

const DEFAULT_TIMEOUT_MS = 10_000

function baseUrl(): string {
  const url =
    process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003'
  return `${url.replace(/\/$/, '')}/v1`
}

function serviceKey(): string {
  const key = process.env.AI_SERVICE_KEY
  if (!key) {
    // Fail loudly server-side rather than sending an unauthenticated request.
    throw new Error(
      'AI_SERVICE_KEY is not configured. Copy it from backend/.env into web/.env.local.',
    )
  }
  return key
}

export interface ProxyOptions {
  query?: Record<string, string | number | undefined | null>
  body?: unknown
  /** Forwarded so the backend localises its response. */
  acceptLanguage?: string
  signal?: AbortSignal
}

/**
 * Calls an ai-tools endpoint with the service key attached.
 *
 * Returns the unwrapped `data`. Throws `ApiError` on failure so the route handler
 * can map it to a status without leaking the upstream body.
 */
export async function proxyToAiTools<T>(
  route: BffRouteKey,
  options: ProxyOptions = {},
): Promise<T> {
  const config = BFF_ROUTES[route]

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const queryString = search.toString()
  const url = `${baseUrl()}/${config.path}${queryString ? `?${queryString}` : ''}`

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-service-key': serviceKey(),
  }
  if (options.acceptLanguage) headers['Accept-Language'] = options.acceptLanguage
  if (config.method === 'POST') headers['Content-Type'] = 'application/json'

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), DEFAULT_TIMEOUT_MS)
  const signals = [timeout.signal, options.signal].filter(Boolean) as AbortSignal[]

  let response: Response
  try {
    response = await fetch(url, {
      method: config.method,
      headers,
      body: config.method === 'POST' ? JSON.stringify(options.body ?? {}) : undefined,
      signal: signals.length > 1 ? AbortSignal.any(signals) : signals[0],
      cache: 'no-store',
    })
  } catch (error) {
    throw new NetworkError(
      error instanceof Error ? error.message : 'Upstream request failed',
    )
  } finally {
    clearTimeout(timer)
  }

  const text = await response.text()
  if (text === '') {
    if (response.ok) return undefined as T
    throw new ApiError({
      status: response.status,
      code: 'INTERNAL_ERROR',
      messages: [response.statusText || 'Upstream request failed'],
    })
  }

  let envelope: { success?: boolean; data?: T; error?: { code?: string; message?: unknown } }
  try {
    envelope = JSON.parse(text)
  } catch {
    throw new NetworkError('Upstream returned a non-JSON response')
  }

  if (!response.ok || envelope.success === false) {
    const raw = envelope.error?.message
    throw new ApiError({
      status: response.status,
      code: envelope.error?.code ?? 'INTERNAL_ERROR',
      messages: Array.isArray(raw) ? raw.map(String) : [String(raw ?? 'Upstream request failed')],
    })
  }

  return envelope.data as T
}
