'use client'

import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import * as React from 'react'

import { Card, Skeleton } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import { Link, useRouter } from '@/lib/i18n/navigation'

/**
 * Gate for routes that need a session.
 *
 * Waits for the initial refresh to settle before deciding — redirecting while the
 * session is still being restored would bounce a signed-in user to the sign-in
 * page on every reload. The intended destination is preserved in `next`.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const account = useTranslations('account')
  const { isAuthenticated, ready } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  React.useEffect(() => {
    if (ready && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [ready, isAuthenticated, router, pathname])

  if (!ready) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Card className="space-y-3 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
      </div>
    )
  }

  if (!isAuthenticated) {
    // Brief interstitial while the redirect above takes effect.
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center sm:px-6">
        <p className="text-[var(--text-secondary)]">{account('signIn.title')}</p>
        <Link href="/login" className="text-sm font-medium text-[var(--accent)] hover:underline">
          {account('signIn.submit')}
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
