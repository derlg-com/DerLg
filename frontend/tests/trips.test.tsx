import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TripCard } from '@/components/trips/TripCard'
import { TripGrid } from '@/components/trips/TripGrid'
import { useFavoritesStore } from '@/stores/favorites.store'
import type { TripSummary } from '@/types/catalog'

const trip: TripSummary = {
  id: 't1',
  slug: 'angkor-wat-sunrise',
  name: 'Angkor Wat Sunrise',
  coverImageUrl: null,
  durationDays: 1,
  priceUsd: 49,
  category: 'Temples',
  location: 'Siem Reap',
  ratingAverage: 4.8,
  ratingCount: 120,
  isFeatured: true,
}

describe('stores/favorites.store', () => {
  beforeEach(() => {
    useFavoritesStore.setState({ ids: [] })
    window.localStorage.clear()
  })

  it('toggles, reflects in has(), and lists by type', () => {
    const s = useFavoritesStore.getState()
    expect(s.has('trip', 't1')).toBe(false)
    s.toggle('trip', 't1')
    expect(useFavoritesStore.getState().has('trip', 't1')).toBe(true)
    expect(useFavoritesStore.getState().list('trip')).toEqual(['t1'])
    useFavoritesStore.getState().toggle('trip', 't1')
    expect(useFavoritesStore.getState().has('trip', 't1')).toBe(false)
  })
})

describe('TripCard', () => {
  beforeEach(() => {
    useFavoritesStore.setState({ ids: [] })
  })

  it('renders name, location, and formatted price', () => {
    render(<TripCard trip={trip} />)
    expect(screen.getByText('Angkor Wat Sunrise')).toBeInTheDocument()
    expect(screen.getByText('Siem Reap')).toBeInTheDocument()
    expect(screen.getByText('$49.00')).toBeInTheDocument()
  })

  it('toggles the wishlist favorite', () => {
    render(<TripCard trip={trip} />)
    const fav = screen.getByRole('button', { name: /wishlist/i })
    expect(fav).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(fav)
    expect(fav).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('TripGrid', () => {
  it('shows the empty state when there are no trips', () => {
    render(<TripGrid trips={[]} />)
    expect(screen.getByText('No trips found')).toBeInTheDocument()
  })

  it('renders a card per trip', () => {
    render(<TripGrid trips={[trip]} />)
    expect(screen.getByText('Angkor Wat Sunrise')).toBeInTheDocument()
  })
})
