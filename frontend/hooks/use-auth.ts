'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { logoutRequest } from '@/lib/auth-api'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const rehydrated = useAuthStore((s) => s.rehydrated)
  return { user, isAuthenticated, rehydrated }
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

export function useLogout() {
  const router = useRouter()
  const clearSession = useAuthStore((s) => s.clearSession)
  return async () => {
    try {
      await logoutRequest()
    } catch {
      // best-effort: clear locally regardless of network outcome
    }
    clearSession()
    router.replace('/login')
  }
}
