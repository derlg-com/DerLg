import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { scorePassword, PasswordStrength } from '@/components/auth/PasswordStrength'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { useAuthStore } from '@/stores/auth.store'

describe('scorePassword', () => {
  it('returns 0 for an empty password', () => {
    expect(scorePassword('')).toBe(0)
  })

  it('caps very short passwords at weak (<= 1) regardless of variety', () => {
    expect(scorePassword('aB1!')).toBeLessThanOrEqual(1)
  })

  it('scores a long mixed-character password as strong (4)', () => {
    expect(scorePassword('Str0ng!Passw0rd')).toBe(4)
  })

  it('increases monotonically as complexity is added', () => {
    const lower = scorePassword('password')
    const mixed = scorePassword('Password1')
    const symbol = scorePassword('Password1!')
    expect(mixed).toBeGreaterThanOrEqual(lower)
    expect(symbol).toBeGreaterThanOrEqual(mixed)
  })
})

describe('PasswordStrength component', () => {
  it('renders nothing when the password is empty', () => {
    const { container } = render(<PasswordStrength password="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a strength label when a password is present', () => {
    render(<PasswordStrength password="Str0ng!Passw0rd" />)
    expect(screen.getByText(/Password strength/i)).toBeInTheDocument()
    expect(screen.getByText('Strong')).toBeInTheDocument()
  })
})

describe('RegisterForm enhancements', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('shows the password strength indicator once the user types a password', () => {
    render(<RegisterForm onSuccess={vi.fn()} />)
    expect(screen.queryByText(/Password strength/i)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ng!Passw0rd' } })
    expect(screen.getByText(/Password strength/i)).toBeInTheDocument()
  })

  it('validates the email field on blur (Requirement 16.3)', () => {
    render(<RegisterForm onSuccess={vi.fn()} />)
    const email = screen.getByLabelText('Email')
    fireEvent.change(email, { target: { value: 'not-an-email' } })
    fireEvent.blur(email)
    expect(email).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(email, { target: { value: 'valid@example.com' } })
    fireEvent.blur(email)
    expect(email).not.toHaveAttribute('aria-invalid', 'true')
  })
})
