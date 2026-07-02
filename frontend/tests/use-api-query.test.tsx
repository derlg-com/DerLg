import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useApiQuery, invalidateApiQuery } from '@/lib/use-api-query'

function res(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) }
}

describe('useApiQuery', () => {
  beforeEach(() => {
    // Each test starts from an empty shared cache.
    invalidateApiQuery()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('loads data from an enveloped GET', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(res(200, { success: true, data: { items: [{ id: 't1' }] } })),
    )
    const { result } = renderHook(() => useApiQuery<{ items: { id: string }[] }>('/v1/trips'))
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toEqual({ items: [{ id: 't1' }] })
    expect(result.current.error).toBeNull()
  })

  it('surfaces an ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(res(500, { success: false, error: { code: 'X', message: 'boom' } })),
    )
    // No retries so the error surfaces immediately.
    const { result } = renderHook(() => useApiQuery('/v1/trips', { retry: 0 }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.message).toBe('boom')
    expect(result.current.data).toBeNull()
  })

  it('does not fetch when disabled', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useApiQuery('/v1/x', { enabled: false }))
    expect(result.current.isLoading).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('serves fresh cache without a second network call (Req 14.6)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { success: true, data: { id: 't1' } }))
    vi.stubGlobal('fetch', fetchMock)

    const first = renderHook(() => useApiQuery('/v1/trips/t1', { staleTime: 60_000 }))
    await waitFor(() => expect(first.result.current.isLoading).toBe(false))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // A second consumer of the same fresh path reuses the cache.
    const second = renderHook(() => useApiQuery('/v1/trips/t1', { staleTime: 60_000 }))
    expect(second.result.current.isLoading).toBe(false)
    expect(second.result.current.data).toEqual({ id: 't1' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refetches once the cache goes stale (Req 14.6)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { success: true, data: { id: 't1' } }))
    vi.stubGlobal('fetch', fetchMock)

    const first = renderHook(() => useApiQuery('/v1/trips/t1', { staleTime: 0 }))
    await waitFor(() => expect(first.result.current.isLoading).toBe(false))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // staleTime 0 => immediately stale, so a new consumer fetches again.
    const second = renderHook(() => useApiQuery('/v1/trips/t1', { staleTime: 0 }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(second.result.current.data).toEqual({ id: 't1' }))
  })

  it('invalidateApiQuery forces dependent queries to refetch (Req 14.6)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { success: true, data: { id: 'b1' } }))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useApiQuery('/v1/bookings', { staleTime: 60_000 }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      invalidateApiQuery('/v1/bookings')
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('refetches on window focus when stale (Req 14.8)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { success: true, data: { id: 't1' } }))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() =>
      useApiQuery('/v1/trips/t1', { staleTime: 0, refetchOnWindowFocus: true }),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('does NOT refetch on focus while still fresh (Req 14.6/14.8)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { success: true, data: { id: 't1' } }))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() =>
      useApiQuery('/v1/trips/t1', { staleTime: 60_000, refetchOnWindowFocus: true }),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    // Still fresh => no extra network call.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries transient 5xx failures with backoff then succeeds (Req 14.9)', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(503, { success: false, error: { code: 'E', message: 'down' } }))
      .mockResolvedValueOnce(res(200, { success: true, data: { id: 't1' } }))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() =>
      useApiQuery('/v1/trips/t1', { retry: 2, staleTime: 60_000 }),
    )

    // Advance through the exponential backoff delay.
    await vi.advanceTimersByTimeAsync(1000)
    await vi.waitFor(() => expect(result.current.data).toEqual({ id: 't1' }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBeNull()
  })

  it('does NOT retry client 4xx errors (Req 14.9)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        res(404, { success: false, error: { code: 'NOT_FOUND', message: 'nope' } }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useApiQuery('/v1/trips/missing', { retry: 3 }))
    await waitFor(() => expect(result.current.error?.status).toBe(404))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
