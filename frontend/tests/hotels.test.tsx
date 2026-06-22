import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HotelCard } from '@/components/hotels/HotelCard'
import { useFavoritesStore } from '@/stores/favorites.store'
import type { HotelSummary } from '@/types/catalog'

const hotel: HotelSummary = {
  id: 'h1',
  slug: 'sokha-siem-reap',
  name: 'Sokha Siem Reap Resort',
  coverImageUrl: null,
  location: 'Siem Reap',
  starRating: 5,
  pricePerNightFrom: 120,
  amenities: ['Pool', 'WiFi'],
  ratingAverage: 4.6,
  ratingCount: 88,
}

describe('HotelCard', () => {
  beforeEach(() => useFavoritesStore.setState({ ids: [] }))

  it('renders name, location, and "from" nightly price', () => {
    render(<HotelCard hotel={hotel} />)
    expect(screen.getByText('Sokha Siem Reap Resort')).toBeInTheDocument()
    expect(screen.getByText('Siem Reap')).toBeInTheDocument()
    expect(screen.getByText('$120.00')).toBeInTheDocument()
  })

  it('links to the hotel detail page', () => {
    render(<HotelCard hotel={hotel} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/hotels/sokha-siem-reap')
  })
})
