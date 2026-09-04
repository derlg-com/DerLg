import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'

import { TokenCallbackHandler } from './token-callback-handler'
import { Skeleton } from '@/components/ui'
import type { Locale } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Authentication Callback',
  robots: { index: false, follow: false },
}

export default async function AuthCallbackPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <TokenCallbackHandler />
      </Suspense>
    </div>
  )
}
