import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { GuestOnlyGuard } from '@/components/auth/GuestOnlyGuard'
import { useAuthStore } from '@/stores/auth.store'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
}))

function setRehydrated(value: boolean) {
  useAuthStore.getState().setRehydrated(value)
}

describe('GuestOnlyGuard', () => {
  beforeEach(() => {
    replace.mockClear()
    useAuthStore.getState().clearSession()
    setRehydrated(false)
    window.history.replaceState({}, '', '/login')
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders children for guests once rehydrated and does not redirect', async () => {
    setRehydrated(true)
    render(
      <GuestOnlyGuard>
        <p>SIGN IN FORM</p>
      </GuestOnlyGuard>,
    )
    expect(screen.getByText('SIGN IN FORM')).toBeInTheDocument()
    await waitFor(() => expect(replace).not.toHaveBeenCalled())
  })

  it('renders children while rehydration is still pending (no flash blocking)', () => {
    // rehydrated=false even though a (stale persisted) user may exist
    render(
      <GuestOnlyGuard>
        <p>SIGN IN FORM</p>
      </GuestOnlyGuard>,
    )
    expect(screen.getByText('SIGN IN FORM')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('suppresses children and redirects home when an authenticated user lands here', async () => {
    useAuthStore.getState().setSession('jwt', {
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      role: 'user',
    })
    setRehydrated(true)
    render(
      <GuestOnlyGuard>
        <p>SIGN IN FORM</p>
      </GuestOnlyGuard>,
    )
    expect(screen.queryByText('SIGN IN FORM')).not.toBeInTheDocument()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
  })

  it('honors a safe same-origin returnUrl when redirecting an authenticated user', async () => {
    window.history.replaceState({}, '', '/login?returnUrl=%2Fprofile')
    useAuthStore.getState().setSession('jwt', {
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      role: 'user',
    })
    setRehydrated(true)
    render(
      <GuestOnlyGuard>
        <p>SIGN IN FORM</p>
      </GuestOnlyGuard>,
    )
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/profile'))
  })

  it('ignores an unsafe protocol-relative returnUrl and falls back home', async () => {
    window.history.replaceState({}, '', '/login?returnUrl=%2F%2Fevil.com')
    useAuthStore.getState().setSession('jwt', {
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      role: 'user',
    })
    setRehydrated(true)
    render(
      <GuestOnlyGuard>
        <p>SIGN IN FORM</p>
      </GuestOnlyGuard>,
    )
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
  })
})
