import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'

import { ExploreMap } from '@/components/map/explore-map'
import { Skeleton } from '@/components/ui'
import type { Locale } from '@/lib/i18n/config'
import { absoluteUrl } from '@/lib/seo'

// Selection and filters live in the query string, so this route must be dynamic.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const explore = await getTranslations({ locale, namespace: 'explore' })

  return {
    title: explore('tabs.title'),
    description: explore('map.description'),
    alternates: { canonical: absoluteUrl('/explore', locale as Locale) },
  }
}

export default async function ExplorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const explore = await getTranslations('explore')

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{explore('tabs.title')}</h1>
        <p className="text-[var(--text-secondary)]">{explore('map.description')}</p>
      </header>

      <Suspense fallback={<Skeleton className="h-[70vh] w-full" />}>
        <ExploreMap />
      </Suspense>
    </div>
  )
}
