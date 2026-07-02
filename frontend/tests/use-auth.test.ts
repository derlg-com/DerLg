import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/profile',
}))

import { useAuth, useLogout } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth.store'
import { getAccessToken, clearAccessToken } from '@/lib/api-client'

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  })
}

describe('hooks/use-auth', () => {
  beforeEach(() => {
    replace.mockClear()
    useAuthStore.getState().clearSession()
    clearAccessToken()
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('login stores the session and primes the api client', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(200, {
        success: true,
        data: {
          accessToken: 'jwt-1',
          user: { id: 'u1', email: 'a@b.com', name: 'Wendy', role: 'user' },
        },
      }),
    )
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.login('a@b.com', 'password123')
    })
    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(true)
    expect(s.user?.id).toBe('u1')
    expect(getAccessToken()).toBe('jwt-1')
  })

  it('register stores the session for the returned user', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(201, {
        success: true,
        data: {
          accessToken: 'jwt-2',
          user: { id: 'u2', email: 'c@d.com', name: null, role: 'user' },
        },
      }),
    )
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.register({ email: 'c@d.com', password: 'password123', name: 'Ben' })
    })
    expect(useAuthStore.getState().user?.id).toBe('u2')
    expect(getAccessToken()).toBe('jwt-2')
  })

  it('login surfaces normalized API errors and leaves state unauthenticated', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(401, {
        success: false,
        error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'bad creds' },
      }),
    )
    const { result } = renderHook(() => useAuth())
    await expect(result.current.login('a@b.com', 'x')).rejects.toThrow('bad creds')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('logout clears the session and redirects to the home page (Req 2.7)', async () => {
    useAuthStore
      .getState()
      .setSession('tok', { id: 'u', email: 'e@e.com', name: null, role: 'user' })
    vi.stubGlobal('fetch', mockFetch(200, { success: true, data: { message: 'ok' } }))
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.logout()
    })
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(getAccessToken()).toBeNull()
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('logout still clears local state when the backend call fails', async () => {
    useAuthStore
      .getState()
      .setSession('tok', { id: 'u', email: 'e@e.com', name: null, role: 'user' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.logout()
    })
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('useLogout redirects to the home page (Req 2.7)', async () => {
    useAuthStore
      .getState()
      .setSession('tok', { id: 'u', email: 'e@e.com', name: null, role: 'user' })
    vi.stubGlobal('fetch', mockFetch(200, { success: true, data: { message: 'ok' } }))
    const { result } = renderHook(() => useLogout())
    await act(async () => {
      await result.current()
    })
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(replace).toHaveBeenCalledWith('/')
  })
})
