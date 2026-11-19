import { NavelHomeCarousel } from '@/components/discovery/navel-home-carousel'
import { tripsApi } from '@/lib/api/resources'
import type { Locale } from '@/lib/i18n/config'
import type { TripSummary } from '@/schemas/domain'

const FALLBACK_DESTINATIONS: TripSummary[] = [
  {
    id: 'angkor-wat-sunrise',
    name: 'Angkor Wat Sunrise & Ancient Temples',
    location: 'Siem Reap, Cambodia',
    category: 'temples',
    coverImageUrl:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
    priceUsd: 120,
    ratingAverage: 4.9,
    ratingCount: 328,
    durationDays: 1,
  },
  {
    id: 'koh-rong-island',
    name: 'Koh Rong Sanloem Island Paradise',
    location: 'Sihanoukville, Cambodia',
    category: 'nature',
    coverImageUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    priceUsd: 180,
    ratingAverage: 4.8,
    ratingCount: 215,
    durationDays: 3,
  },
  {
    id: 'phnom-penh-heritage',
    name: 'Royal Palace & Silk Island Heritage',
    location: 'Phnom Penh, Cambodia',
    category: 'culture',
    coverImageUrl:
      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80',
    priceUsd: 85,
    ratingAverage: 4.9,
    ratingCount: 194,
    durationDays: 1,
  },
  {
    id: 'mondulkiri-elephant-sanctuary',
    name: 'Mondulkiri Wilderness & Elephant Trek',
    location: 'Sen Monorom, Mondulkiri',
    category: 'adventure',
    coverImageUrl:
      'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=800&q=80',
    priceUsd: 240,
    ratingAverage: 5.0,
    ratingCount: 142,
    durationDays: 2,
  },
]

export async function NavelFeaturedTrips({ locale }: { locale: Locale }) {
  let trips: TripSummary[] = []

  try {
    const res = await tripsApi.list({ limit: 8, sort: 'rating_desc' }, { locale })
    if (res && res.items && res.items.length > 0) {
      trips = res.items
    }
  } catch (err) {
    console.warn('[NavelFeaturedTrips] API load failed, using fallback catalogue:', err)
  }

  const finalTrips = trips.length > 0 ? trips : FALLBACK_DESTINATIONS

  return <NavelHomeCarousel trips={finalTrips} title="Recommendation" />
}
