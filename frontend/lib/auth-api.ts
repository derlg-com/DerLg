import { api } from './api-client'
import type { AuthUser } from '@/types/api'

export interface AuthResponse {
  accessToken: string
  user: AuthUser
}

export function loginRequest(email: string, password: string) {
  return api.post<AuthResponse>('/v1/auth/login', { email, password }, { auth: false })
}

export function registerRequest(body: {
  email: string
  password: string
  name?: string
  phone?: string
}) {
  return api.post<AuthResponse>('/v1/auth/register', body, { auth: false })
}

export function forgotPasswordRequest(email: string) {
  return api.post<{ message: string }>('/v1/auth/forgot-password', { email }, { auth: false })
}

export function resetPasswordRequest(token: string, newPassword: string) {
  return api.post<{ message: string }>(
    '/v1/auth/reset-password',
    { token, newPassword },
    { auth: false },
  )
}

export function logoutRequest() {
  return api.post<{ message: string }>('/v1/auth/logout')
}

/**
 * Change the authenticated user's password (Requirement 8.5).
 *
 * ⚠️ BACKEND CONTRACT ASSUMPTION — endpoint not implemented yet.
 *
 * As of this writing the NestJS auth controller (`backend/src/modules/auth/
 * auth.controller.ts`) exposes only the *public* `forgot-password` (email) and
 * `reset-password` (token) flows. There is NO authenticated endpoint that
 * accepts `{ currentPassword, newPassword }` for a logged-in user.
 *
 * This client assumes the following contract, to be implemented backend-side:
 *
 *   POST /v1/auth/change-password   (authenticated; Bearer access token)
 *   body:    { currentPassword: string, newPassword: string }
 *   success: 200 with `{ success, data, message }` envelope
 *   errors:  401 / 400 when the current password is incorrect
 *            404 (or whatever a missing route returns) until implemented
 *
 * Until the endpoint exists this call will fail; the calling form degrades
 * gracefully and surfaces a localized error (see ChangePasswordForm).
 */
export function changePasswordRequest(currentPassword: string, newPassword: string) {
  return api.post<{ message: string }>('/v1/auth/change-password', {
    currentPassword,
    newPassword,
  })
}
