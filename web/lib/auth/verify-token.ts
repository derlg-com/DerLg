/**
 * Server-side JWT inspection.
 *
 * The access token is issued and signed by the backend. This module only needs
 * the subject claim, and it VERIFIES the signature before trusting it — decoding
 * without verification would let a caller forge any `sub` they liked and read
 * another user's data through the BFF.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export interface VerifiedToken {
  sub: string
  exp?: number
}

function base64UrlDecode(segment: string): Buffer {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='), 'base64')
}

/**
 * Verifies an HS256 token against the backend's access secret.
 *
 * Returns null for anything suspect — bad shape, wrong algorithm, bad signature,
 * expired, or missing subject. Callers treat null as "not authenticated".
 */
export function verifyAccessToken(token: string | undefined | null): VerifiedToken | null {
  if (!token) return null

  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) {
    // Fail closed: without the secret we cannot distinguish a real token from a
    // forged one, so no request may be treated as authenticated.
    console.error('[bff] JWT_ACCESS_SECRET is not configured; treating all requests as guests')
    return null
  }

  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string]

  let header: { alg?: string }
  let payload: { sub?: string; user_id?: string; exp?: number }
  try {
    header = JSON.parse(base64UrlDecode(headerPart).toString('utf8'))
    payload = JSON.parse(base64UrlDecode(payloadPart).toString('utf8'))
  } catch {
    return null
  }

  // Only HS256 is accepted; `none` or an asymmetric alg would bypass the check.
  if (header.alg !== 'HS256') return null

  const expected = createHmac('sha256', secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest()
  const actual = base64UrlDecode(signaturePart)

  if (expected.length !== actual.length) return null
  if (!timingSafeEqual(expected, actual)) return null

  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) return null

  const sub = payload.sub ?? payload.user_id
  if (typeof sub !== 'string' || sub === '') return null

  return { sub, exp: payload.exp }
}

/** Extracts a bearer token from an Authorization header. */
export function bearerFrom(header: string | null): string | null {
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  return token === '' ? null : token
}
