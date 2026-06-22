'use client'

import type { ReactNode } from 'react'
import { useApiQuery } from '@/lib/use-api-query'
import { buildQuery } from '@/lib/api-client'
import { useTranslations } from '@/lib/i18n'
import { SearchHero } from './search-hero'
import { CategoryTiles } from './category-tiles'
import { Shelf, ShelfItem, ShelfSkeleton } from './shelf'
import { TripCard } from '@/components/trips/TripCard'
import { HotelCard } from '@/components/hotels/HotelCard'
import { GuideCard } from '@/components/guides/GuideCard'
import type { Paginated } from '@/types/api'
import type { TripSummary, HotelSummary, GuideSummary } from '@/types/catalog'

interface QueryLike<T> {
  data?: Paginated<T> | null
  isLoading: boolean
  error: unknown
}

interface CatalogShelfProps<T> {
  query: QueryLike<T>
  title: string
  subtitle?: string
  seeAllHref: string
  seeAllLabel: string
  square?: boolean
  renderCard: (item: T) => ReactNode
}

/**
 * Renders one shelf: a loading skeleton while fetching, the card row when items
 * are present, and nothing on error or empty (so the landing never shows a
 * bare/broken section). `id` is required on items for stable keys.
 */
function CatalogShelf<T extends { id: string }>({
  query,
  title,
  subtitle,
  seeAllHref,
  seeAllLabel,
  square,
  renderCard,
}: CatalogShelfProps<T>) {
  if (query.isLoading) {
    return (
      <Shelf title={title} subtitle={subtitle} seeAllHref={seeAllHref} seeAllLabel={seeAllLabel}>
        <ShelfSkeleton square={square} />
      </Shelf>
    )
  }

  const items = query.data?.items ?? []
  if (query.error || items.length === 0) return null

  return (
    <Shelf title={title} subtitle={subtitle} seeAllHref={seeAllHref} seeAllLabel={seeAllLabel}>
      {items.map((item) => (
        <ShelfItem key={item.id} className={square ? 'w-40 sm:w-48' : undefined}>
          {renderCard(item)}
        </ShelfItem>
      ))}
    </Shelf>
  )
}

/**
 * TripAdvisor-style browse landing: hero search → category tiles → curated
 * shelves of trips, stays, and guides. Distinct from the /vibe-booking chat
 * (reachable via the hero "Ask AI" button and the app-wide concierge bubble).
 */
export function ExploreLanding() {
  const t = useTranslations('explore')
  const seeAll = t('seeAll')

  const trips = useApiQuery<Paginated<TripSummary>>(
    `/v1/trips${buildQuery({ sort: 'featured', limit: 10 })}`,
  )
  const hotels = useApiQuery<Paginated<HotelSummary>>(`/v1/hotels${buildQuery({ limit: 10 })}`)
  const guides = useApiQuery<Paginated<GuideSummary>>(`/v1/guides${buildQuery({ limit: 10 })}`)

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-5">
      <SearchHero />
      <CategoryTiles />

      <CatalogShelf
        query={trips}
        title={t('shelves.tripsTitle')}
        subtitle={t('shelves.tripsSubtitle')}
        seeAllHref="/trips"
        seeAllLabel={seeAll}
        renderCard={(trip) => <TripCard trip={trip} />}
      />
      <CatalogShelf
        query={hotels}
        title={t('shelves.hotelsTitle')}
        subtitle={t('shelves.hotelsSubtitle')}
        seeAllHref="/hotels"
        seeAllLabel={seeAll}
        renderCard={(hotel) => <HotelCard hotel={hotel} />}
      />
      <CatalogShelf
        query={guides}
        title={t('shelves.guidesTitle')}
        subtitle={t('shelves.guidesSubtitle')}
        seeAllHref="/guides"
        seeAllLabel={seeAll}
        square
        renderCard={(guide) => <GuideCard guide={guide} />}
      />
    </div>
  )
}
