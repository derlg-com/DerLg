import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'

import { HotelsBrowser } from '@/components/hotels/hotels-browser'
import { Skeleton } from '@/components/ui'
import type { Locale } from '@/lib/i18n/config'
import { absoluteUrl } from '@/lib/seo'

// Filter-driven: see the note on the trips list route about static routes
// swallowing query-string navigation.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'explore' })

  return {
    title: t('shelves.hotelsTitle'),
    description: t('shelves.hotelsSubtitle'),
    alternates: { canonical: absoluteUrl('/hotels', locale as Locale) },
  }
}

export default async function HotelsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const t = await getTranslations('explore')

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('shelves.hotelsTitle')}</h1>
        <p className="text-[var(--text-secondary)]">{t('shelves.hotelsSubtitle')}</p>
      </header>

      <Suspense fallback={<Skeleton className="h-12 w-full" />}>
        <HotelsBrowser />
      </Suspense>
    </div>
  )
}
