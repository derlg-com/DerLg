import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginForm } from '@/components/auth/LoginForm'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { useAuthStore } from '@/stores/auth.store'
import { getAccessToken } from '@/lib/api-client'

function res(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) }
}

describe('auth forms', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('LoginForm: valid credentials set the session and call onSuccess', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        res(200, {
          success: true,
          data: {
            accessToken: 'jwt',
            user: { id: 'u1', email: 'a@b.com', name: 'A', role: 'user' },
          },
        }),
      ),
    )
    const onSuccess = vi.fn()
    render(<LoginForm onSuccess={onSuccess} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(getAccessToken()).toBe('jwt')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('LoginForm: 401 shows an invalid-credentials error and does not authenticate', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          res(401, { success: false, error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'bad' } }),
        ),
    )
    render(<LoginForm onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.'),
    )
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('LoginForm: blocks submit on invalid email (client-side Zod)', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<LoginForm onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('LoginForm: validates email field on blur and clears the error once corrected', () => {
    render(<LoginForm onSuccess={vi.fn()} />)
    const email = screen.getByLabelText('Email')
    fireEvent.change(email, { target: { value: 'not-an-email' } })
    fireEvent.blur(email)
    expect(email).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(email, { target: { value: 'valid@example.com' } })
    fireEvent.blur(email)
    expect(email).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('RegisterForm: 409 surfaces an email-exists field error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          res(409, { success: false, error: { code: 'AUTH_EMAIL_EXISTS', message: 'exists' } }),
        ),
    )
    render(<RegisterForm onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() =>
      expect(screen.getByText('That email is already registered.')).toBeInTheDocument(),
    )
  })
})
