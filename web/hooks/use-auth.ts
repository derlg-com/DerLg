'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import * as React from 'react'

import { authApi, type LoginInput, type RegisterInput } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/errors'
import {
  clearSession,
  getServerSession,
  getSession,
  setSession,
  subscribeToSession,
} from '@/lib/auth/session'
import type { Locale } from '@/lib/i18n/config'

/** Reads the current session. Safe in server-rendered trees: SSR sees a guest. */
export function useSession() {
  return React.useSyncExternalStore(subscribeToSession, getSession, getServerSession)
}

/**
 * Access token for authenticated requests, or null for a guest.
 *
 * Components should pass this to the API client rather than reading storage, so
 * there is exactly one source of truth.
 */
export function useAccessToken(): string | null {
  return useSession().token
}

export function useAuth() {
  const session = useSession()
  const locale = useLocale() as Locale
  const queryClient = useQueryClient()

  const login = useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input, locale),
    onSuccess: (result) => {
      setSession({ token: result.accessToken, user: result.user ?? null, ready: true })
      // Authenticated views may hold guest-scoped data.
      void queryClient.invalidateQueries()
    },
  })

  const register = useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input, locale),
    onSuccess: (result) => {
      setSession({ token: result.accessToken, user: result.user ?? null, ready: true })
      void queryClient.invalidateQueries()
    },
  })

  const logout = useMutation({
    mutationFn: () => authApi.logout(session.token),
    // Clear locally even if the call fails: the user asked to sign out, and the
    // refresh cookie is invalidated server-side on its next use regardless.
    onSettled: () => {
      clearSession()
      queryClient.clear()
    },
  })

  return {
    ...session,
    isAuthenticated: Boolean(session.token),
    login,
    register,
    logout,
  }
}

/**
 * Maps an auth failure to a user-facing message key.
 *
 * The backend's own message is never shown: it can leak whether an email exists,
 * and rate-limit responses read as internal errors.
 */
export function authErrorKey(error: unknown): 'invalidCredentials' | 'emailExists' | 'rateLimited' {
  if (!(error instanceof ApiError)) return 'invalidCredentials'
  if (error.isRateLimited) return 'rateLimited'
  if (error.code === 'AUTH_EMAIL_EXISTS' || error.status === 409) return 'emailExists'
  return 'invalidCredentials'
}
