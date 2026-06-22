'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '@/types/api'
import {
  setAccessToken as primeApiToken,
  clearAccessToken as clearApiToken,
} from '@/lib/api-client'

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
  /** True once the initial session-rehydration attempt has completed. */
  rehydrated: boolean
  setSession: (accessToken: string, user: AuthUser) => void
  setAccessToken: (token: string) => void
  setUser: (user: AuthUser) => void
  setRehydrated: (value: boolean) => void
  clearSession: () => void
}

/**
 * Auth state. The access token lives in memory only (never persisted); the user
 * profile is persisted so the UI can render immediately on reload while the
 * token is re-obtained via `/v1/auth/refresh`. All token writes are mirrored
 * into the api client so authenticated requests carry the Bearer header.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      rehydrated: false,
      setSession: (accessToken, user) => {
        primeApiToken(accessToken)
        set({ accessToken, user, isAuthenticated: true })
      },
      setAccessToken: (accessToken) => {
        primeApiToken(accessToken)
        set({ accessToken, isAuthenticated: true })
      },
      setUser: (user) => set({ user }),
      setRehydrated: (rehydrated) => set({ rehydrated }),
      clearSession: () => {
        clearApiToken()
        set({ accessToken: null, user: null, isAuthenticated: false })
      },
    }),
    {
      name: 'derlg:auth',
      partialize: (s) => ({ user: s.user }),
    },
  ),
)
