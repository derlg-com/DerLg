import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  api,
  ApiError,
  TimeoutError,
  setAccessToken,
  getAccessToken,
  clearAccessToken,
  setAcceptLanguage,
  getAcceptLanguage,
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
    setAcceptLanguage(null)
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
          res(400, {
            success: false,
            error: { code: 'BKNG_INVALID_DATE_RANGE', message: 'bad dates' },
          }),
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

  it('forwards Accept-Language for the active locale (Req 13.7)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { success: true, data: {} }))
    vi.stubGlobal('fetch', fetchMock)
    setAcceptLanguage('zh')
    expect(getAcceptLanguage()).toBe('zh')
    await api.get('/v1/trips/t1')
    expect(headersOf(fetchMock, 0)['Accept-Language']).toBe('zh')
  })

  it('omits Accept-Language when no locale is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { success: true, data: {} }))
    vi.stubGlobal('fetch', fetchMock)
    await api.get('/v1/trips/t1')
    expect(headersOf(fetchMock, 0)['Accept-Language']).toBeUndefined()
  })

  it('lets an explicit per-request Accept-Language header win', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { success: true, data: {} }))
    vi.stubGlobal('fetch', fetchMock)
    setAcceptLanguage('zh')
    await api.get('/v1/trips/t1', { headers: { 'Accept-Language': 'km' } })
    expect(headersOf(fetchMock, 0)['Accept-Language']).toBe('km')
  })

  it('on 401 refreshes once then retries with the fresh token', async () => {
    setAccessToken('stale')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        res(401, { success: false, error: { code: 'AUTH', message: 'expired' } }),
      )
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
      .mockResolvedValue(
        res(401, {
          success: false,
          error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'bad creds' },
        }),
      )
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

  // --- Requirement 15.7: timeout configuration ---

  it('aborts the request and throws TimeoutError when the timeout elapses', async () => {
    vi.useFakeTimers()
    try {
      // fetch never resolves on its own; it rejects only when its signal aborts.
      const fetchMock = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<MockRes>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            )
          }),
      )
      vi.stubGlobal('fetch', fetchMock)

      // No retries so the timeout surfaces directly.
      const promise = api.get('/v1/slow', { timeoutMs: 1000, retries: 0 })
      const assertion = expect(promise).rejects.toBeInstanceOf(TimeoutError)
      await vi.advanceTimersByTimeAsync(1000)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })

  it('passes the caller signal through and rethrows caller-initiated aborts unchanged', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<MockRes>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const promise = api.get('/v1/cancellable', { signal: controller.signal, retries: 2 })
    controller.abort()
    // Caller aborts are surfaced as AbortError, never wrapped or retried.
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // --- Requirement 15.9: retry with exponential backoff ---

  it('retries network errors with backoff then succeeds', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(res(200, { success: true, data: { ok: true } }))
      vi.stubGlobal('fetch', fetchMock)

      const promise = api.get<{ ok: boolean }>('/v1/flaky', { retries: 2, timeoutMs: 0 })
      await vi.runAllTimersAsync()
      await expect(promise).resolves.toEqual({ ok: true })
      expect(fetchMock).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('retries 5xx responses then surfaces the error after exhausting retries', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(res(503, { success: false, error: { code: 'SVC', message: 'down' } }))
      vi.stubGlobal('fetch', fetchMock)

      const promise = api.get('/v1/unstable', { retries: 2, timeoutMs: 0 })
      const assertion = expect(promise).rejects.toMatchObject({ status: 503 })
      await vi.runAllTimersAsync()
      await assertion
      // initial attempt + 2 retries
      expect(fetchMock).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not retry 4xx responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        res(400, { success: false, error: { code: 'BAD', message: 'bad request' } }),
      )
    vi.stubGlobal('fetch', fetchMock)
    await expect(api.get('/v1/bad', { retries: 2 })).rejects.toMatchObject({ status: 400 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
