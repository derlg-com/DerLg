import { NextResponse, type NextRequest } from 'next/server'

import {
  BFF_ROUTES,
  isBffRoute,
  proxyToAiTools,
  type BffRouteKey,
} from '@/lib/api/ai-tools-proxy'
import { ApiError } from '@/lib/api/errors'
import { bearerFrom, verifyAccessToken } from '@/lib/auth/verify-token'

/**
 * BFF proxy for the service-key-protected `/v1/ai-tools/*` endpoints.
 *
 * Design constraints, in order of importance:
 *
 *  1. The service key never leaves the server. It is attached here and no
 *     response echoes it back.
 *  2. Only an explicit allowlist is reachable. An unknown path is a 404, not a
 *     pass-through — a wildcard proxy would expose the agent's write tools
 *     (booking holds, SOS) to anyone who guessed the path.
 *  3. For user-scoped routes the `user_id` comes from the VERIFIED JWT subject.
 *     Any client-supplied `user_id` is dropped.
 *  4. Errors are mapped to a status and a code. The upstream message is not
 *     forwarded, since it can carry internal detail.
 */

/** Simple per-IP fixed-window limiter, enough to blunt accidental hammering. */
const RATE_LIMIT = { windowMs: 60_000, max: 60 }
const hits = new Map<string, { count: number; resetAt: number }>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const entry = hits.get(key)

  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs })
    return false
  }

  entry.count += 1
  if (entry.count > RATE_LIMIT.max) return true

  // Opportunistic cleanup so the map cannot grow without bound.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
  }
  return false
}

function clientKey(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

async function handle(request: NextRequest, routeKey: string, method: 'GET' | 'POST') {
  if (!isBffRoute(routeKey)) {
    // Not in the allowlist: indistinguishable from a route that does not exist.
    return failure(404, 'NOT_FOUND', 'Unknown endpoint')
  }

  const config = BFF_ROUTES[routeKey as BffRouteKey]
  if (config.method !== method) {
    return failure(405, 'METHOD_NOT_ALLOWED', 'Method not allowed for this endpoint')
  }

  if (rateLimited(clientKey(request))) {
    return failure(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests')
  }

  // Collect query params (GET) or body (POST) from the caller.
  const query: Record<string, string> = {}
  for (const [key, value] of request.nextUrl.searchParams) query[key] = value

  let body: Record<string, unknown> = {}
  if (method === 'POST') {
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      body = {}
    }
  }

  // User-scoped routes: derive the identity server-side, never from the client.
  if (config.auth === 'user') {
    const verified = verifyAccessToken(bearerFrom(request.headers.get('authorization')))
    if (!verified) {
      return failure(401, 'UNAUTHORIZED', 'Sign in to use this feature')
    }
    delete query.user_id
    delete body.user_id
    if (method === 'GET') query.user_id = verified.sub
    else body.user_id = verified.sub
  }

  try {
    const data = await proxyToAiTools(routeKey, {
      query,
      body,
      acceptLanguage: request.headers.get('accept-language') ?? undefined,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof ApiError) {
      // Validation detail is safe and useful; anything else stays generic.
      const message = error.isValidation ? error.message : 'Upstream request failed'
      return failure(error.status === 0 ? 502 : error.status, error.code, message)
    }
    console.error('[bff] unexpected proxy failure:', error)
    return failure(500, 'INTERNAL_ERROR', 'Unexpected error')
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  return handle(request, path.join('/'), 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  return handle(request, path.join('/'), 'POST')
}
