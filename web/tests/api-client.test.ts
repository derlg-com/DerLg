import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, buildQuery, request } from '@/lib/api/client'
import { ApiError, NetworkError, TimeoutError } from '@/lib/api/errors'

const API = 'http://localhost:3003/v1'

function jsonResponse(body: unknown, init: { status?: number; statusText?: string } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3003')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

/** Reads the URL and init of the nth fetch call. */
function callArgs(index = 0) {
  const call = fetchMock.mock.calls[index]
  return { url: String(call?.[0]), init: (call?.[1] ?? {}) as RequestInit }
}

describe('buildQuery', () => {
  it('returns an empty string for no params', () => {
    expect(buildQuery()).toBe('')
    expect(buildQuery({})).toBe('')
  })

  it('serialises primitives', () => {
    expect(buildQuery({ page: 2, limit: 20, q: 'angkor' })).toBe('?page=2&limit=20&q=angkor')
  })

  it('omits undefined and null so the backend never sees an unknown value', () => {
    expect(buildQuery({ page: 1, category: undefined, province: null })).toBe('?page=1')
  })

  it('omits empty and whitespace-only strings, treating a cleared filter as absent', () => {
    expect(buildQuery({ q: '', sort: '   ', page: 1 })).toBe('?page=1')
  })

  it('encodes values with spaces and non-ASCII characters', () => {
    expect(buildQuery({ q: 'Siem Reap' })).toBe('?q=Siem+Reap')
    expect(buildQuery({ location: 'ភ្នំពេញ' })).toContain('location=')
  })

  it('keeps boolean and zero values, which are meaningful', () => {
    expect(buildQuery({ verified: false, priceMin: 0 })).toBe('?verified=false&priceMin=0')
  })
})

describe('request — envelope unwrapping', () => {
  it('returns data directly, hiding the envelope from callers', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 't1', name: 'Angkor' } }))

    const result = await request<{ id: string; name: string }>('trips/t1')
    expect(result).toEqual({ id: 't1', name: 'Angkor' })
  })

  it('returns the paginated payload nested inside data', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: { items: [{ id: 't1' }], total: 5, page: 1, limit: 2, totalPages: 3 },
      }),
    )

    const result = await api.list<{ id: string }>('trips')
    expect(result.items).toHaveLength(1)
    expect(result.total).toBe(5)
    expect(result.totalPages).toBe(3)
  })

  it('treats 204 as a successful empty response', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })))
    await expect(request('auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('treats an empty 200 body as a successful empty response', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('', { status: 200 })))
    await expect(request('auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })
})

describe('request — error mapping', () => {
  it('maps a 404 error envelope to an ApiError flagged as not found', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { success: false, error: { code: 'TRP_NOT_FOUND', message: 'Trip not found' } },
        { status: 404 },
      ),
    )

    const error = await request('trips/missing').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.status).toBe(404)
    expect(apiError.code).toBe('TRP_NOT_FOUND')
    expect(apiError.message).toBe('Trip not found')
    expect(apiError.isNotFound).toBe(true)
    expect(apiError.isRetryable).toBe(false)
  })

  it('collects every message when validation returns an array', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: ['property bogus should not exist', 'category must be one of the following'],
          },
        },
        { status: 400 },
      ),
    )

    const error = (await request('trips').catch((e: unknown) => e)) as ApiError
    expect(error.messages).toHaveLength(2)
    expect(error.message).toBe('property bogus should not exist')
    expect(error.isValidation).toBe(true)
    expect(error.isRetryable).toBe(false)
  })

  it('flags 401 as unauthorized so callers can trigger a refresh', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Unauthorized' } },
        { status: 401 },
      ),
    )

    const error = (await request('bookings').catch((e: unknown) => e)) as ApiError
    expect(error.isUnauthorized).toBe(true)
  })

  it('flags 5xx as retryable', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Boom' } },
        { status: 503 },
      ),
    )

    const error = (await request('trips').catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(503)
    expect(error.isRetryable).toBe(true)
  })

  it('flags 429 as rate limited and retryable', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
        { status: 429 },
      ),
    )

    const error = (await request('auth/login', { method: 'POST' }).catch(
      (e: unknown) => e,
    )) as ApiError
    expect(error.isRateLimited).toBe(true)
    expect(error.isRetryable).toBe(true)
  })

  it('rejects a success: false body even when the HTTP status is 200', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, error: { code: 'CONFLICT', message: 'Already exists' } }),
    )

    const error = (await request('trips').catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('CONFLICT')
  })

  it('reports a non-JSON body as a network failure rather than crashing', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>502 Bad Gateway</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    )

    const error = (await request('trips').catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(NetworkError)
  })

  it('wraps a transport failure as NetworkError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = (await request('trips').catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(NetworkError)
    expect(error.status).toBe(0)
    expect(error.isRetryable).toBe(true)
  })
})

describe('request — headers', () => {
  beforeEach(() => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ success: true, data: {} })))
  })

  it('always requests JSON', async () => {
    await request('trips')
    expect((callArgs().init.headers as Record<string, string>).Accept).toBe('application/json')
  })

  it('sends a weighted Accept-Language for a non-default locale', async () => {
    await request('trips', { locale: 'km' })
    const headers = callArgs().init.headers as Record<string, string>
    expect(headers['Accept-Language']).toBe('km-KH,en-US;q=0.8')
  })

  it('sends the bare tag for the default locale', async () => {
    await request('trips', { locale: 'en' })
    const headers = callArgs().init.headers as Record<string, string>
    expect(headers['Accept-Language']).toBe('en-US')
  })

  it('omits Accept-Language when no locale is given', async () => {
    await request('trips')
    const headers = callArgs().init.headers as Record<string, string>
    expect(headers['Accept-Language']).toBeUndefined()
  })

  it('attaches a bearer token when provided', async () => {
    await request('bookings', { token: 'abc123' })
    const headers = callArgs().init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer abc123')
  })

  it('omits Authorization for a guest request', async () => {
    await request('trips', { token: null })
    const headers = callArgs().init.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('forwards an idempotency key for booking creation', async () => {
    await api.post('trips/t1/bookings', { participants: 2 }, { idempotencyKey: 'key-1' })
    const headers = callArgs().init.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBe('key-1')
  })

  it('sets Content-Type only when there is a body', async () => {
    await request('trips')
    expect((callArgs(0).init.headers as Record<string, string>)['Content-Type']).toBeUndefined()

    await api.post('trips', { name: 'x' })
    expect((callArgs(1).init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    )
  })

  it('sends credentials so the refresh cookie travels with the request', async () => {
    await request('auth/refresh', { method: 'POST' })
    expect(callArgs().init.credentials).toBe('include')
  })
})

describe('request — URL construction', () => {
  beforeEach(() => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ success: true, data: {} })))
  })

  it('prefixes /v1 and normalises a leading slash', async () => {
    await request('/trips')
    expect(callArgs().url).toBe(`${API}/trips`)
  })

  it('appends the serialised query', async () => {
    await request('trips', { query: { page: 2, category: 'temples' } })
    expect(callArgs().url).toBe(`${API}/trips?page=2&category=temples`)
  })

  it('uses the verb helpers with the right method', async () => {
    await api.get('trips')
    expect(callArgs(0).init.method).toBe('GET')

    await api.post('trips', {})
    expect(callArgs(1).init.method).toBe('POST')

    await api.patch('bookings/b1', {})
    expect(callArgs(2).init.method).toBe('PATCH')

    await api.delete('bookings/b1')
    expect(callArgs(3).init.method).toBe('DELETE')
  })
})

describe('request — cancellation', () => {
  it('reports a caller abort as a cancellation, not a network failure', async () => {
    const controller = new AbortController()
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })

    const promise = request('trips', { signal: controller.signal })
    controller.abort()

    const error = (await promise.catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(TimeoutError)
    expect(error.message).toBe('The request was cancelled')
  })

  it('times out a request that never settles', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })

    const error = (await request('trips', { timeoutMs: 10 }).catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(TimeoutError)
    expect(error.message).toBe('The request timed out')
  })
})
