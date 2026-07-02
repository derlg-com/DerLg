import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useAuthStore } from '@/stores/auth.store'

// Drive BookingShell's auth gate + capture the post-delete redirect.
const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/profile/preferences',
}))

import { PreferencesView } from '@/components/profile/PreferencesView'

function res(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) }
}

function authenticate() {
  useAuthStore.getState().setSession('test-token', {
    id: 'u1',
    email: 'wendy@example.com',
    name: 'Wendy',
    role: 'user',
  })
  useAuthStore.getState().setRehydrated(true)
}

describe('Delete account flow (Req 8.8, 50.8)', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
    replace.mockClear()
    authenticate()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useAuthStore.getState().clearSession()
  })

  it('requires explicit confirmation before deletion is enabled', () => {
    render(<PreferencesView />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))

    const confirmBtn = screen.getByRole('button', { name: 'Yes, delete my account' })
    expect(confirmBtn).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), {
      target: { value: 'nope' },
    })
    expect(screen.getByRole('button', { name: 'Yes, delete my account' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), {
      target: { value: 'DELETE' },
    })
    expect(screen.getByRole('button', { name: 'Yes, delete my account' })).toBeEnabled()
  })

  it('calls DELETE /v1/users/me, clears the session, and redirects on success', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(res(200, { success: true, data: null }) as unknown as Response)

    render(<PreferencesView />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), {
      target: { value: 'DELETE' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete my account' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/users/me')
    expect(init.method).toBe('DELETE')

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
      expect(replace).toHaveBeenCalledWith('/')
    })
  })

  it('keeps the session when the backend call fails (graceful degradation)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      res(500, { success: false, error: { code: 'ERR', message: 'boom' } }) as unknown as Response,
    )

    render(<PreferencesView />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), {
      target: { value: 'DELETE' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete my account' }))

    await waitFor(() => {
      // Session remains intact; no redirect on failure.
      expect(useAuthStore.getState().isAuthenticated).toBe(true)
      expect(replace).not.toHaveBeenCalled()
    })
  })
})
