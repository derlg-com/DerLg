import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import { getAccessToken } from '@/lib/api-client'

describe('stores/auth.store', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })

  it('setSession sets user/token/isAuthenticated and primes the api client', () => {
    useAuthStore.getState().setSession('tok-9', {
      id: 'u1',
      email: 'a@b.com',
      name: 'Wendy',
      role: 'user',
    })
    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(true)
    expect(s.user?.id).toBe('u1')
    expect(s.accessToken).toBe('tok-9')
    expect(getAccessToken()).toBe('tok-9')
  })

  it('clearSession clears state and the api-client token', () => {
    useAuthStore.getState().setSession('tok', { id: 'u', email: 'e@e.com', name: null, role: 'user' })
    useAuthStore.getState().clearSession()
    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(false)
    expect(s.user).toBeNull()
    expect(s.accessToken).toBeNull()
    expect(getAccessToken()).toBeNull()
  })

  it('setAccessToken marks authenticated and primes the client', () => {
    useAuthStore.getState().setAccessToken('fresh')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(getAccessToken()).toBe('fresh')
  })
})
