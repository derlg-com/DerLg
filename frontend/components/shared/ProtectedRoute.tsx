'use client'

import { useRequireAuth } from '@/hooks/use-auth'
import { Spinner } from '@/components/ui/spinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Rendered while the session is still rehydrating. Defaults to a spinner. */
  fallback?: React.ReactNode
}

/**
 * Reusable auth gate for protected routes/pages (Requirement 2.8, 2.9).
 *
 * Renders `fallback` while the session rehydrates, then either renders
 * `children` for authenticated users or nothing — {@link useRequireAuth}
 * redirects unauthenticated visitors to `/login?returnUrl=…` once rehydration
 * settles. Wrap any page subtree that must not render for guests:
 *
 * ```tsx
 * <ProtectedRoute>
 *   <ProfilePage />
 * </ProtectedRoute>
 * ```
 */
export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { isAuthenticated, rehydrated } = useRequireAuth()

  if (!rehydrated) {
    return (
      fallback ?? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )
    )
  }

  if (!isAuthenticated) return null

  return <>{children}</>
}
