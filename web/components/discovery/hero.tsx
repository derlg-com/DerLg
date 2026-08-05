import { getTranslations } from 'next-intl/server'

import { CategoryTiles } from '@/components/discovery/category-tiles'
import { HeroSearch } from '@/components/discovery/hero-search'
import { Link } from '@/lib/i18n/navigation'

/**
 * Home hero.
 *
 * Leads with the conversational entry point, since that is the product's
 * differentiator, while keeping a conventional browse path for users who would
 * rather not chat.
 */
export async function Hero() {
  const brand = await getTranslations('brand')
  const explore = await getTranslations('explore')
  const trips = await getTranslations('trips')
  const shell = await getTranslations('shell')

  return (
    <section className="border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {brand('headline')}
          </h1>
          <p className="max-w-2xl text-lg text-[var(--text-secondary)]">{brand('subline')}</p>

          <HeroSearch />

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/chat"
              className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-hover)]"
            >
              {explore('hero.askAi')}
            </Link>
            <Link
              href="/trips"
              className="inline-flex min-h-11 items-center rounded-md border border-[var(--border-default)] bg-[var(--surface)] px-5 text-sm font-medium transition-colors duration-[var(--duration-fast)] hover:bg-[var(--surface-hover)]"
            >
              {trips('home.exploreAll')}
            </Link>
          </div>

          <p className="text-sm text-[var(--text-tertiary)]">{shell('brand')} · {brand('tagline')}</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <CategoryTiles />
      </div>
    </section>
  )
}
