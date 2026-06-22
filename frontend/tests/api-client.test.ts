import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  api,
  ApiError,
  setAccessToken,
  getAccessToken,
  clearAccessToken,
  buildQuery,
} from '@/lib/api-client'

type MockRes = { ok: boolean; status: number; text: () => Promise<string> }

function res(status: number, body?: unknown): MockRes {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }
}

function headersOf(mock: ReturnType<typeof vi.fn>, call: number): Record<string, string> {
  return mock.mock.calls[call][1].headers as Record<string, string>
}

describe('lib/api-client', () => {
  beforeEach(() => {
    clearAccessToken()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('unwraps the { success, data } envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(res(200, { success: true, data: { items: [1, 2], total: 2 } })),
    )
    const data = await api.get<{ items: number[]; total: number }>('/v1/trips')
    expect(data).toEqual({ items: [1, 2], total: 2 })
  })

  it('returns the raw body when it is not enveloped', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(200, { accessToken: 'x' })))
    const data = await api.get<{ accessToken: string }>('/v1/whatever')
    expect(data.accessToken).toBe('x')
  })

  it('throws a normalized ApiError on an enveloped error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          res(400, { success: false, error: { code: 'BKNG_INVALID_DATE_RANGE', message: 'bad dates' } }),
        ),
    )
    await expect(api.get('/v1/x')).rejects.toBeInstanceOf(ApiError)
    await expect(api.get('/v1/x')).rejects.toMatchObject({
      code: 'BKNG_INVALID_DATE_RANGE',
      message: 'bad dates',
      status: 400,
    })
  })

  it('injects the Bearer token when set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { success: true, data: {} }))
    vi.stubGlobal('fetch', fetchMock)
    setAccessToken('tok-1')
    await api.get('/v1/users/me')
    expect(headersOf(fetchMock, 0).Authorization).toBe('Bearer tok-1')
  })

  it('does not attach a Bearer token when auth:false', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { success: true, data: {} }))
    vi.stubGlobal('fetch', fetchMock)
    setAccessToken('tok-1')
    await api.post('/v1/auth/login', { email: 'a@b.c', password: 'x' }, { auth: false })
    expect(headersOf(fetchMock, 0).Authorization).toBeUndefined()
  })

  it('on 401 refreshes once then retries with the fresh token', async () => {
    setAccessToken('stale')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(401, { success: false, error: { code: 'AUTH', message: 'expired' } }))
      .mockResolvedValueOnce(res(200, { success: true, data: { accessToken: 'fresh' } }))
      .mockResolvedValueOnce(res(200, { success: true, data: { id: 'me' } }))
    vi.stubGlobal('fetch', fetchMock)

    const data = await api.get<{ id: string }>('/v1/users/me')

    expect(data).toEqual({ id: 'me' })
    expect(getAccessToken()).toBe('fresh')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(headersOf(fetchMock, 2).Authorization).toBe('Bearer fresh')
  })

  it('does not retry login (auth:false) on 401 — surfaces the error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(res(401, { success: false, error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'bad creds' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      api.post('/v1/auth/login', { email: 'a@b.c', password: 'x' }, { auth: false }),
    ).rejects.toThrow('bad creds')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('adds an Idempotency-Key when requested', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(201, { success: true, data: {} }))
    vi.stubGlobal('fetch', fetchMock)
    await api.post('/v1/hotels/h1/bookings', { roomId: 'r1' }, { idempotencyKey: true })
    expect(headersOf(fetchMock, 0)['Idempotency-Key']).toBeTruthy()
  })

  it('buildQuery omits empty values and expands arrays', () => {
    expect(buildQuery({ a: 1, b: '', c: undefined, d: null, e: ['x', 'y'] })).toBe('?a=1&e=x&e=y')
    expect(buildQuery({})).toBe('')
  })
})
