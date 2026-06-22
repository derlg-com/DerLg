'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useApiQuery } from '@/lib/use-api-query'
import { buildQuery } from '@/lib/api-client'
import { FeaturedHero } from './FeaturedHero'
import { CategoryRow } from './CategoryRow'
import { TripGrid } from './TripGrid'
import { useTranslations } from '@/lib/i18n'
import type { Paginated } from '@/types/api'
import type { TripCategory, TripSummary } from '@/types/catalog'

export function HomeFeed() {
  const t = useTranslations('trips')
  const [category, setCategory] = useState<TripCategory | null>(null)

  const featured = useApiQuery<Paginated<TripSummary>>(
    `/v1/trips${buildQuery({ limit: 6 })}`,
  )
  const grid = useApiQuery<Paginated<TripSummary>>(
    `/v1/trips${buildQuery({ category: category?.toLowerCase(), sort: 'featured', page: 1, limit: 12 })}`,
  )

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-4">
      <section className="space-y-3">
        <h1 className="text-xl font-bold text-foreground">{t('home.featured')}</h1>
        <FeaturedHero trips={featured.data?.items ?? []} isLoading={featured.isLoading} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t('home.categories')}</h2>
          <Link
            href="/trips"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {t('home.exploreAll')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <CategoryRow selected={category} onSelect={setCategory} />
        <TripGrid
          trips={grid.data?.items ?? []}
          isLoading={grid.isLoading}
          isError={Boolean(grid.error)}
          onRetry={grid.refetch}
          onClearFilters={() => setCategory(null)}
        />
      </section>
    </div>
  )
}
