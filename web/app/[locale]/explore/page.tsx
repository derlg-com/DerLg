import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'

import { ExploreMap } from '@/components/map/explore-map'
import { Skeleton } from '@/components/ui'
import { placesApi } from '@/lib/api/resources'
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

export default async function ExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ category?: string }>
}) {
  const { locale } = await params
  const { category } = (await searchParams) ?? {}
  setRequestLocale(locale as Locale)
  const typed = locale as Locale

  const initialData = await placesApi
    .list({ limit: 50, category }, { locale: typed })
    .catch(() => undefined)

  return (
    <div className="space-y-4 px-3 py-4">
      <Suspense fallback={<Skeleton className="h-[70vh] w-full rounded-[28px]" />}>
        <ExploreMap initialData={initialData} />
      </Suspense>
    </div>
  )
}
