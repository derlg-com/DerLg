import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { SearchResults } from '@/components/search/search-results'
import type { Locale } from '@/lib/i18n/config'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'search' })
  // Search result pages carry no unique content worth indexing.
  return { title: t('promptTitle'), robots: { index: false, follow: true } }
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const { q } = await searchParams
  const t = await getTranslations('search')

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('promptTitle')}</h1>
      <SearchResults term={q ?? ''} />
    </div>
  )
}
