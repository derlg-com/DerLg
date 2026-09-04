import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'

import { LoginForm } from '@/components/auth/login-form'
import { Skeleton } from '@/components/ui'
import type { Locale } from '@/lib/i18n/config'

// Reads the `next` query param, so it cannot be statically prerendered.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'account' })
  return { title: t('signIn.title'), robots: { index: false, follow: false } }
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
