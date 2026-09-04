import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'

import { TripsBrowser } from '@/components/trips/trips-browser'
import { Skeleton } from '@/components/ui'
import type { Locale } from '@/lib/i18n/config'
import { absoluteUrl } from '@/lib/seo'

/*
 * Filter-driven and therefore dynamic. Beyond correctness of caching, this is
 * required for navigation: when the route is statically prerendered, the client
 * router treats `/trips` and `/trips?priceMin=…` as the same cache entry and
 * silently skips the URL update, which breaks "clear filters".
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'explore' })
  const typed = locale as Locale

  return {
    title: t('shelves.tripsTitle'),
    description: t('shelves.tripsSubtitle'),
    alternates: { canonical: absoluteUrl('/trips', typed) },
  }
}

export default async function TripsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const t = await getTranslations('explore')

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('shelves.tripsTitle')}</h1>
        <p className="text-[var(--text-secondary)]">{t('shelves.tripsSubtitle')}</p>
      </header>

      {/* The browser reads filters from the URL, which requires Suspense. */}
      <Suspense fallback={<Skeleton className="h-12 w-full" />}>
        <TripsBrowser />
      </Suspense>
    </div>
  )
}
