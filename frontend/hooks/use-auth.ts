'use client'

import { useCallback, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { loginRequest, registerRequest, logoutRequest } from '@/lib/auth-api'

/** Payload accepted by {@link useAuth}'s `register` action. */
export interface RegisterPayload {
  email: string
  password: string
  name?: string
  phone?: string
}

/**
 * Primary authentication hook. Exposes the current session
 * (`user` / `isAuthenticated` / `rehydrated`) together with the imperative
 * `login`, `register`, and `logout` actions.
 *
 * Tokens are never touched directly here: `login`/`register` persist the
 * access token in memory + user profile via the Zustand store (which mirrors
 * the token into the api client), and the refresh token rides in an httpOnly
 * cookie managed by the backend. `logout` is best-effort — local state is
 * always cleared even if the network call fails — and redirects to the home
 * page (Requirement 2.7).
 */
export function useAuth() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const rehydrated = useAuthStore((s) => s.rehydrated)

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginRequest(email, password)
    useAuthStore.getState().setSession(res.accessToken, res.user)
    return res.user
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await registerRequest(payload)
    useAuthStore.getState().setSession(res.accessToken, res.user)
    return res.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } catch {
      // best-effort: clear locally regardless of network outcome
    }
    useAuthStore.getState().clearSession()
    router.replace('/')
  }, [router])

  return { user, isAuthenticated, rehydrated, login, register, logout }
}

/**
 * Guard for protected pages. Once session rehydration has settled, redirects
 * unauthenticated users to /login with a returnUrl. Returns the current auth
 * status so the page can render a loading state until `rehydrated`.
 */
export function useRequireAuth() {
  const router = useRouter()
  const pathname = usePathname()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const rehydrated = useAuthStore((s) => s.rehydrated)

  useEffect(() => {
    if (rehydrated && !isAuthenticated) {
      router.replace(`/login?returnUrl=${encodeURIComponent(pathname)}`)
    }
  }, [rehydrated, isAuthenticated, router, pathname])

  return { isAuthenticated, rehydrated }
}

/**
 * Guard for auth pages (login, register, password flows). Once session
 * rehydration has settled, redirects already-authenticated users away from the
 * auth screens — to `returnUrl` when present and same-origin, otherwise home.
 * Returns the current auth status so the caller can hold rendering until
 * `rehydrated` to avoid a flash of the form for logged-in users.
 */
export function useRedirectIfAuthenticated() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const rehydrated = useAuthStore((s) => s.rehydrated)

  useEffect(() => {
    if (!rehydrated || !isAuthenticated) return
    // Honor a safe same-origin returnUrl if the user was sent here mid-flow.
    const params = new URLSearchParams(window.location.search)
    const returnUrl = params.get('returnUrl')
    const dest =
      returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/'
    router.replace(dest)
  }, [rehydrated, isAuthenticated, router])

  return { isAuthenticated, rehydrated }
}

/**
 * Standalone logout action. Clears the session (best-effort backend call) and
 * redirects to the home page per Requirement 2.7. Prefer {@link useAuth}'s
 * `logout` in new code; retained for existing call sites.
 */
export function useLogout() {
  const router = useRouter()
  const clearSession = useAuthStore((s) => s.clearSession)
  return useCallback(async () => {
    try {
      await logoutRequest()
    } catch {
      // best-effort: clear locally regardless of network outcome
    }
    clearSession()
    router.replace('/')
  }, [clearSession, router])
}
