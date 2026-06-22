import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useApiQuery } from '@/lib/use-api-query'

function res(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) }
}

describe('useApiQuery', () => {
  afterEach(() => {
    vi.restoreAllMocks()
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
      vi.fn().mockResolvedValue(res(500, { success: false, error: { code: 'X', message: 'boom' } })),
    )
    const { result } = renderHook(() => useApiQuery('/v1/trips'))
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
})
