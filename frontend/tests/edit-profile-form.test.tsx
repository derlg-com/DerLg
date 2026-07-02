import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { toUpdateProfilePayload } from '@/hooks/use-update-profile'
import { useAuthStore } from '@/stores/auth.store'
import type { UserProfile } from '@/types/api'

// EditProfileForm fetches the current user via useApiQuery; drive that with a
// mock so we can render the form directly, matching the suite's mocking style.
const useApiQuery = vi.fn()
vi.mock('@/lib/use-api-query', () => ({
  useApiQuery: (...args: unknown[]) => useApiQuery(...args),
}))

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/profile/edit',
}))

import { EditProfileForm } from '@/components/profile/EditProfileForm'

const USER: UserProfile = {
  id: 'u1',
  email: 'wendy@example.com',
  name: 'Wendy',
  phone: '+855 12 000 111',
  avatarUrl: null,
  role: 'user',
  loyaltyPoints: 0,
  isStudent: false,
  createdAt: '2026-01-01T00:00:00.000Z',
}

function res(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) }
}

describe('toUpdateProfilePayload (Req 8.2 — backend field mapping)', () => {
  it('maps name onto fullName and omits empty fields', () => {
    expect(toUpdateProfilePayload({ name: 'Wendy', phone: '', avatarUrl: '' })).toEqual({
      fullName: 'Wendy',
    })
  })

  it('never includes an email field (email is immutable here)', () => {
    const payload = toUpdateProfilePayload({
      name: 'Wendy',
      phone: '+855 12 000 111',
      avatarUrl: 'https://example.com/a.png',
    })
    expect('email' in payload).toBe(false)
    expect(payload).toEqual({
      fullName: 'Wendy',
      phone: '+855 12 000 111',
      avatarUrl: 'https://example.com/a.png',
    })
  })

  it('produces an empty payload when all fields are blank', () => {
    expect(toUpdateProfilePayload({ name: '', phone: '', avatarUrl: '' })).toEqual({})
  })
})

describe('EditProfileForm (Req 8.1, 8.2)', () => {
  beforeEach(() => {
    useApiQuery.mockReset()
    useApiQuery.mockReturnValue({ data: USER, isLoading: false, error: null, refetch: vi.fn() })
    useAuthStore.getState().clearSession()
    useAuthStore.getState().setSession('test-token', {
      id: 'u1',
      email: 'wendy@example.com',
      name: 'Wendy',
      role: 'user',
    })
    useAuthStore.getState().setRehydrated(true)
    window.localStorage.clear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders email read-only with an immutability hint (Req 8.1)', () => {
    render(<EditProfileForm />)
    const email = screen.getByLabelText('Email') as HTMLInputElement
    expect(email.value).toBe('wendy@example.com')
    expect(email).toBeDisabled()
    expect(screen.getByText("Email can't be changed here.")).toBeInTheDocument()
  })

  it('PATCHes /v1/users/me with fullName (not name) on save (Req 8.2)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(res(200, { success: true, data: { ...USER, name: 'Wendy Wong' } }))
    vi.stubGlobal('fetch', fetchMock)

    render(<EditProfileForm />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Wendy Wong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/v1/users/me')
    expect(init.method).toBe('PATCH')
    const body = JSON.parse(init.body as string)
    expect(body.fullName).toBe('Wendy Wong')
    expect('name' in body).toBe(false)
    expect('email' in body).toBe(false)
  })

  it('blocks submit and shows a field error for an invalid phone (Req 8.2)', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<EditProfileForm />)
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: 'not-a-phone' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText('Enter a valid phone number')).toBeInTheDocument()
  })

  it('validates a field on blur with an accessible error association', () => {
    render(<EditProfileForm />)
    const name = screen.getByLabelText('Name')
    fireEvent.change(name, { target: { value: 'A' } })
    fireEvent.blur(name)
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAttribute('aria-describedby', 'name-error')
    fireEvent.change(name, { target: { value: 'Alice' } })
    fireEvent.blur(name)
    expect(name).not.toHaveAttribute('aria-invalid', 'true')
  })
})
