import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { authErrorKey } from '@/hooks/use-auth'
import { authApi } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/errors'
import {
  clearSession,
  getServerSession,
  getSession,
  resetSessionForTests,
  setSession,
  subscribeToSession,
} from '@/lib/auth/session'
import { passwordStrength, loginSchema, registerSchema } from '@/schemas/auth'

let fetchMock: ReturnType<typeof vi.fn>

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  resetSessionForTests()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3003')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  resetSessionForTests()
})

describe('session store', () => {
  it('starts as a guest that is not yet ready', () => {
    expect(getSession()).toEqual({ token: null, user: null, ready: false })
  })

  it('always reports a guest during SSR', () => {
    expect(getServerSession().token).toBeNull()
  })

  it('notifies subscribers when the session changes', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToSession(listener)

    setSession({ token: 'abc', ready: true })
    expect(listener).toHaveBeenCalled()
    expect(getSession().token).toBe('abc')

    unsubscribe()
    setSession({ token: 'def' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('marks the session ready when cleared, so guards stop waiting', () => {
    setSession({ token: 'abc', ready: false })
    clearSession()

    expect(getSession()).toEqual({ token: null, user: null, ready: true })
  })

  it('never persists the token to storage', () => {
    setSession({ token: 'secret-token', ready: true })

    // A token in localStorage would be readable by any injected script and would
    // outlive the tab; the refresh cookie is the only durable credential.
    const stored = JSON.stringify({
      local: Object.entries(localStorage),
      session: Object.entries(sessionStorage),
    })
    expect(stored).not.toContain('secret-token')
  })
})

describe('authApi', () => {
  it('sends only the fields the register DTO declares', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ success: true, data: { accessToken: 't', user: { id: 'u' } } })),
    )

    await authApi.register({ email: 'a@b.co', password: 'password12', name: '', phone: '' }, 'en')

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    // Blank optional fields are omitted, not sent as empty strings, because the
    // backend rejects unknown/invalid values.
    expect(Object.keys(body).sort()).toEqual(['email', 'password'])
  })

  it('includes name and phone when provided', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ success: true, data: { accessToken: 't' } })),
    )

    await authApi.register(
      { email: 'a@b.co', password: 'password12', name: 'Sokha', phone: '+855' },
      'en',
    )

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body).toMatchObject({ name: 'Sokha', phone: '+855' })
  })

  it('sends credentials so the refresh cookie travels', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ success: true, data: { accessToken: 't' } })),
    )

    await authApi.refresh()
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe('include')
  })

  it('parses a refresh response that carries no user', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ success: true, data: { accessToken: 'new-token' } })),
    )

    const result = await authApi.refresh()
    expect(result.accessToken).toBe('new-token')
    expect(result.user ?? null).toBeNull()
  })

  it('attaches the access token when logging out', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ success: true, data: { message: 'ok' } })),
    )

    await authApi.logout('my-token')
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer my-token')
  })

  it('parses the profile from users/me', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          success: true,
          data: {
            id: 'u1',
            email: 'a@b.co',
            name: 'Sokha',
            phone: null,
            avatarUrl: null,
            role: 'user',
            loyaltyPoints: 0,
            isStudent: false,
            createdAt: '2026-08-01T00:00:00.000Z',
          },
        }),
      ),
    )

    const user = await authApi.me('token', 'en')
    expect(user).toMatchObject({ id: 'u1', name: 'Sokha', isStudent: false })
  })
})

describe('authErrorKey', () => {
  it('maps a rate limit to its own message', () => {
    const error = new ApiError({ status: 429, code: 'RATE_LIMIT_EXCEEDED', messages: ['slow down'] })
    expect(authErrorKey(error)).toBe('rateLimited')
  })

  it('maps a duplicate email', () => {
    const error = new ApiError({ status: 409, code: 'AUTH_EMAIL_EXISTS', messages: ['exists'] })
    expect(authErrorKey(error)).toBe('emailExists')
  })

  it('falls back to invalid credentials for anything else', () => {
    const error = new ApiError({ status: 401, code: 'INTERNAL_ERROR', messages: ['Unauthorized'] })
    expect(authErrorKey(error)).toBe('invalidCredentials')
    expect(authErrorKey(new Error('boom'))).toBe('invalidCredentials')
  })
})

describe('auth form schemas', () => {
  it('requires a valid email and a password', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true)
  })

  it('enforces the backend password minimum of 8 characters', () => {
    const base = { email: 'a@b.co', confirmPassword: 'short12' }
    expect(registerSchema.safeParse({ ...base, password: 'short12' }).success).toBe(false)
    expect(
      registerSchema.safeParse({ email: 'a@b.co', password: 'longenough1', confirmPassword: 'longenough1' })
        .success,
    ).toBe(true)
  })

  it('reports a password mismatch on the confirm field', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.co',
      password: 'longenough1',
      confirmPassword: 'different12',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword'])
    }
  })

  it('scores password strength monotonically', () => {
    expect(passwordStrength('')).toBe(0)
    expect(passwordStrength('short')).toBeLessThan(passwordStrength('longenough12'))
    expect(passwordStrength('longenough12')).toBeLessThanOrEqual(
      passwordStrength('LongEnough12!'),
    )
  })
})
