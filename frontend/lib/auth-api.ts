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
