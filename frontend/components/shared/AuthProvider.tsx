'use client'

import { useEffect } from 'react'
import { api, setAuthErrorHandler } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthUser, UserProfile } from '@/types/api'

/**
 * Rehydrates the session on app start: tries `/v1/auth/refresh` (cookie-based)
 * and, on success, loads the current user. Also registers the global 401
 * handler that clears state and bounces to /login. State updates happen inside
 * promise callbacks (lint-safe; never synchronous in the effect body).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    setAuthErrorHandler(() => {
      useAuthStore.getState().clearSession()
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.href = `/login?returnUrl=${returnUrl}`
      }
    })

    api
      .post<{ accessToken: string }>('/v1/auth/refresh', undefined, { auth: false })
      .then((data) => {
        useAuthStore.getState().setAccessToken(data.accessToken)
        return api.get<UserProfile>('/v1/users/me')
      })
      .then((profile) => {
        const user: AuthUser = {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
        }
        useAuthStore.getState().setUser(user)
      })
      .catch(() => {
        useAuthStore.getState().clearSession()
      })
      .finally(() => {
        useAuthStore.getState().setRehydrated(true)
      })

    return () => setAuthErrorHandler(null)
  }, [])

  return <>{children}</>
}
