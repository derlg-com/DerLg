'use client'

import { useRedirectIfAuthenticated } from '@/hooks/use-auth'

interface GuestOnlyGuardProps {
  children: React.ReactNode
}

/**
 * Inverse of {@link ProtectedRoute}: keeps the auth screens (login, register,
 * forgot/reset password) for guests only. Once the session has rehydrated,
 * {@link useRedirectIfAuthenticated} sends already-authenticated users to their
 * `returnUrl` (when same-origin) or home, and we suppress the form during that
 * brief window to avoid flashing a sign-in form at a logged-in user.
 *
 * Children render immediately for guests and while rehydration is still pending
 * so there is no perceptible delay for the common (unauthenticated) case.
 */
export function GuestOnlyGuard({ children }: GuestOnlyGuardProps) {
  const { isAuthenticated, rehydrated } = useRedirectIfAuthenticated()

  if (rehydrated && isAuthenticated) return null

  return <>{children}</>
}
