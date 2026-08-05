import { createHmac } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BFF_EXCLUDED, BFF_ROUTES, isBffRoute } from '@/lib/api/ai-tools-proxy'
import { bearerFrom, verifyAccessToken } from '@/lib/auth/verify-token'

const SECRET = 'test-access-secret-at-least-32-characters-long'

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Mints a token the way the backend does, so verification is tested for real. */
function signToken(
  payload: Record<string, unknown>,
  options: { secret?: string; alg?: string } = {},
): string {
  const header = base64Url(JSON.stringify({ alg: options.alg ?? 'HS256', typ: 'JWT' }))
  const body = base64Url(JSON.stringify(payload))
  const signature = createHmac('sha256', options.secret ?? SECRET)
    .update(`${header}.${body}`)
    .digest()
  return `${header}.${body}.${base64Url(signature)}`
}

const futureExp = () => Math.floor(Date.now() / 1000) + 900
const pastExp = () => Math.floor(Date.now() / 1000) - 60

beforeEach(() => {
  vi.stubEnv('JWT_ACCESS_SECRET', SECRET)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('BFF allowlist', () => {
  it('permits only the documented read-only and user-scoped routes', () => {
    expect(Object.keys(BFF_ROUTES).sort()).toEqual(
      [
        'budget/estimate',
        'emergency-contacts',
        'festivals',
        'loyalty',
        'payments/status',
        'places',
        'sos',
        'weather',
      ].sort(),
    )
  })

  it('rejects any path outside the allowlist', () => {
    for (const path of ['ai-tools/bookings', 'bookings', 'payments/qr', '../secrets', '']) {
      expect(isBffRoute(path)).toBe(false)
    }
  })

  it('never exposes the agent write tools', () => {
    // Creating holds, minting payable QR codes and the duplicate search endpoints
    // must stay server-to-server between the agent and the backend.
    for (const excluded of BFF_EXCLUDED) {
      const proxied = Object.values(BFF_ROUTES).map((route) => route.path)
      expect(proxied).not.toContain(excluded)
    }
  })

  it('marks loyalty and sos as user-scoped so the id comes from the token', () => {
    expect(BFF_ROUTES.loyalty.auth).toBe('user')
    expect(BFF_ROUTES.sos.auth).toBe('user')
  })

  it('keeps catalogue-style reads public', () => {
    expect(BFF_ROUTES.festivals.auth).toBe('public')
    expect(BFF_ROUTES.weather.auth).toBe('public')
    expect(BFF_ROUTES['emergency-contacts'].auth).toBe('public')
  })
})

describe('verifyAccessToken', () => {
  it('accepts a correctly signed, unexpired token', () => {
    const token = signToken({ sub: 'user-1', exp: futureExp() })
    expect(verifyAccessToken(token)).toEqual({ sub: 'user-1', exp: expect.any(Number) })
  })

  it('rejects a token signed with a different secret', () => {
    const token = signToken({ sub: 'user-1', exp: futureExp() }, { secret: 'other-secret-value' })
    expect(verifyAccessToken(token)).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const token = signToken({ sub: 'user-1', exp: futureExp() })
    const [header, , signature] = token.split('.')
    const forged = base64Url(JSON.stringify({ sub: 'admin', exp: futureExp() }))
    expect(verifyAccessToken(`${header}.${forged}.${signature}`)).toBeNull()
  })

  it('rejects the alg:none downgrade', () => {
    const header = base64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
    const body = base64Url(JSON.stringify({ sub: 'admin', exp: futureExp() }))
    expect(verifyAccessToken(`${header}.${body}.`)).toBeNull()
  })

  it('rejects an expired token', () => {
    expect(verifyAccessToken(signToken({ sub: 'user-1', exp: pastExp() }))).toBeNull()
  })

  it('rejects a token with no subject', () => {
    expect(verifyAccessToken(signToken({ exp: futureExp() }))).toBeNull()
  })

  it('accepts user_id as an alternative subject claim', () => {
    expect(verifyAccessToken(signToken({ user_id: 'user-2', exp: futureExp() }))?.sub).toBe(
      'user-2',
    )
  })

  it('rejects malformed input', () => {
    for (const value of ['', 'not-a-token', 'a.b', 'a.b.c.d', null, undefined]) {
      expect(verifyAccessToken(value as string | null)).toBeNull()
    }
  })

  it('fails closed when the secret is not configured', () => {
    vi.stubEnv('JWT_ACCESS_SECRET', '')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Without the secret a forged token is indistinguishable from a real one, so
    // nothing may be treated as authenticated.
    expect(verifyAccessToken(signToken({ sub: 'user-1', exp: futureExp() }))).toBeNull()

    spy.mockRestore()
  })
})

describe('bearerFrom', () => {
  it('extracts the token from a bearer header', () => {
    expect(bearerFrom('Bearer abc.def.ghi')).toBe('abc.def.ghi')
  })

  it('ignores other schemes and empty values', () => {
    expect(bearerFrom('Basic abc')).toBeNull()
    expect(bearerFrom('Bearer ')).toBeNull()
    expect(bearerFrom(null)).toBeNull()
  })
})
