import { getTranslations } from 'next-intl/server'

import { Shelf } from '@/components/discovery/shelf'
import { GuideCard, HotelCard, TripCard } from '@/components/shared/catalog-cards'
import { guidesApi, hotelsApi, tripsApi } from '@/lib/api/resources'
import type { Locale } from '@/lib/i18n/config'

/**
 * Discovery shelves, rendered on the server so the catalogue is in the initial
 * HTML for crawlers and for users on slow connections.
 *
 * A failing shelf renders nothing instead of taking the page down: an outage in
 * the hotels query should not deny the user the trips they came for. The failure
 * is logged server-side rather than shown, since there is no action the visitor
 * could take.
 */

const REVALIDATE_SECONDS = 300

async function safeFetch<T>(label: string, load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch (error) {
    console.error(`[discovery] ${label} shelf failed:`, error)
    return null
  }
}

export async function TripsShelf({ locale }: { locale: Locale }) {
  const t = await getTranslations('explore')
  const data = await safeFetch('trips', () =>
    tripsApi.list({ limit: 8, sort: 'rating_desc' }, { locale }),
  )

  if (!data || data.items.length === 0) return null

  return (
    <Shelf title={t('shelves.tripsTitle')} subtitle={t('shelves.tripsSubtitle')} href="/trips">
      {data.items.map((trip, index) => (
        <li key={trip.id}>
          {/* The first card is usually the largest contentful paint on mobile. */}
          <TripCard trip={trip} locale={locale} priority={index === 0} />
        </li>
      ))}
    </Shelf>
  )
}

export async function HotelsShelf({ locale }: { locale: Locale }) {
  const t = await getTranslations('explore')
  const data = await safeFetch('hotels', () => hotelsApi.list({ limit: 8 }, { locale }))

  if (!data || data.items.length === 0) return null

  return (
    <Shelf title={t('shelves.hotelsTitle')} subtitle={t('shelves.hotelsSubtitle')} href="/hotels">
      {data.items.map((hotel) => (
        <li key={hotel.id}>
          <HotelCard hotel={hotel} />
        </li>
      ))}
    </Shelf>
  )
}

export async function GuidesShelf({ locale }: { locale: Locale }) {
  const t = await getTranslations('explore')
  const data = await safeFetch('guides', () => guidesApi.list({ limit: 8 }, { locale }))

  if (!data || data.items.length === 0) return null

  return (
    <Shelf title={t('shelves.guidesTitle')} subtitle={t('shelves.guidesSubtitle')} href="/guides">
      {data.items.map((guide) => (
        <li key={guide.id}>
          <GuideCard guide={guide} />
        </li>
      ))}
    </Shelf>
  )
}

export { REVALIDATE_SECONDS }
