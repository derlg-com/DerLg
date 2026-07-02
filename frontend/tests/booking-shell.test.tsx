import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BookingShell } from '@/components/booking/BookingShell'
import { useAuthStore } from '@/stores/auth.store'

// BookingShell is the shared auth gate wrapping every account-scoped route
// (bookings, profile + sub-pages, checkout + sub-pages). It delegates to
// useRequireAuth, which redirects unauthenticated visitors to
// /login?returnUrl=<current-path> once the session has rehydrated.
//
// Validates: Requirements 2.8 (protect authenticated routes by checking
// validity before rendering) and 2.9 (redirect to login with a returnUrl
// parameter for unauthenticated access) — design Property 6.

const replace = vi.fn()
let pathname = '/profile'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => pathname,
}))

function setRehydrated(value: boolean) {
  useAuthStore.getState().setRehydrated(value)
}

describe('BookingShell (protected route gate)', () => {
  beforeEach(() => {
    replace.mockClear()
    pathname = '/profile'
    useAuthStore.getState().clearSession()
    setRehydrated(false)
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders a loading state and does not redirect while the session rehydrates', () => {
    // rehydrated=false: we must not decide the user is a guest yet (Req 2.8).
    const { container } = render(
      <BookingShell>
        <p>PROTECTED CONTENT</p>
      </BookingShell>,
    )
    expect(screen.queryByText('PROTECTED CONTENT')).not.toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    // a spinner placeholder is shown instead of the protected subtree
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('redirects unauthenticated users to /login with the current path as returnUrl', async () => {
    setRehydrated(true)
    render(
      <BookingShell>
        <p>PROTECTED CONTENT</p>
      </BookingShell>,
    )
    expect(screen.queryByText('PROTECTED CONTENT')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/login?returnUrl=${encodeURIComponent('/profile')}`),
    )
  })

  it('preserves the intended destination in the returnUrl for any protected path', async () => {
    pathname = '/checkout/abc-123/payment-method'
    setRehydrated(true)
    render(
      <BookingShell>
        <p>PROTECTED CONTENT</p>
      </BookingShell>,
    )
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        `/login?returnUrl=${encodeURIComponent('/checkout/abc-123/payment-method')}`,
      ),
    )
  })

  it('renders children for authenticated users without redirecting', async () => {
    useAuthStore.getState().setSession('jwt', {
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      role: 'user',
    })
    setRehydrated(true)
    render(
      <BookingShell>
        <p>PROTECTED CONTENT</p>
      </BookingShell>,
    )
    expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument()
    await waitFor(() => expect(replace).not.toHaveBeenCalled())
  })
})
