import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { authenticate, getStoredUserId, getStoredToken } from '@/lib/auth'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'

describe('lib/auth', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getStoredUserId generates and persists a stable guest id', () => {
    const first = getStoredUserId()
    expect(first).toMatch(/^guest-/)
    expect(getStoredUserId()).toBe(first)
  })

  it('authenticate persists token + real user id on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: 'jwt-123', user: { id: 'real-uuid' } }),
      }),
    )
    const result = await authenticate('login', 'a@b.com', 'password123')
    expect(result.userId).toBe('real-uuid')
    expect(getStoredToken()).toBe('jwt-123')
    expect(getStoredUserId()).toBe('real-uuid')
  })

  it('authenticate throws on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: 'bad creds' }) }),
    )
    await expect(authenticate('login', 'a@b.com', 'x')).rejects.toThrow('bad creds')
  })
})

describe('store auth modal', () => {
  it('setAuthModalOpen toggles the flag', () => {
    useVibeBookingStore.getState().setAuthModalOpen(true)
    expect(useVibeBookingStore.getState().authModalOpen).toBe(true)
    useVibeBookingStore.getState().setAuthModalOpen(false)
    expect(useVibeBookingStore.getState().authModalOpen).toBe(false)
  })
})
