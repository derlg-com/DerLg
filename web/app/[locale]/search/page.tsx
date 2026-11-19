import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Search as SearchIcon } from 'lucide-react'

import { SearchResults } from '@/components/search/search-results'
import type { Locale } from '@/lib/i18n/config'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'search' })
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
    <div className="space-y-5 px-4 py-4 sm:px-6">
      {/* NAVEL Form/Search-Active-filled Search Bar */}
      <form action={`/${locale}/search`} method="GET" className="relative flex items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--color-navel-forest)]/60 dark:text-[var(--color-navel-mint)]/60" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder={t('placeholder')}
            className="w-full rounded-full bg-[var(--color-navel-cream)]/70 dark:bg-[var(--surface-sunken)] border border-[var(--border-subtle)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navel-jade)] focus:border-transparent transition-all shadow-sm"
          />
        </div>
      </form>

      <SearchResults term={q ?? ''} />
    </div>
  )
}
