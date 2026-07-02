import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlaceCard } from '@/components/explore/PlaceCard'
import { PlaceGrid } from '@/components/explore/PlaceGrid'
import {
  PLACE_CATEGORIES,
  PLACE_PRICE_FILTERS,
  filterPlacesByPrice,
  isFreePlace,
  resolvePlaceCategory,
  resolvePlacePrice,
} from '@/types/explore'
import type { PlaceSummary } from '@/types/domain'

// Task 8.2 — Explore → Places tab. Covers the pure filter logic
// (category/price resolution + client-side price filtering) and the
// PlaceCard / PlaceGrid rendering (image fallback, category badge, entry fee,
// loading / error / empty states).
//
// Validates: Requirements 4.2 (places + category/price filtering),
// 4.7/4.8 (filter selection drives the displayed results), 4.9 (list rendering).

function makePlace(overrides: Partial<PlaceSummary> = {}): PlaceSummary {
  return {
    id: 'p1',
    name: 'Angkor Wat',
    category: 'temple',
    latitude: 13.41,
    longitude: 103.86,
    entryFeeUsd: 37,
    coverImage: null,
    ...overrides,
  }
}

describe('explore filter resolvers', () => {
  it('resolvePlaceCategory accepts known categories and rejects others', () => {
    for (const c of PLACE_CATEGORIES) {
      expect(resolvePlaceCategory(c)).toBe(c)
    }
    expect(resolvePlaceCategory(null)).toBeNull()
    expect(resolvePlaceCategory(undefined)).toBeNull()
    expect(resolvePlaceCategory('')).toBeNull()
    expect(resolvePlaceCategory('castle')).toBeNull()
  })

  it('resolvePlacePrice falls back to "all" for unknown values', () => {
    for (const p of PLACE_PRICE_FILTERS) {
      expect(resolvePlacePrice(p)).toBe(p)
    }
    expect(resolvePlacePrice(null)).toBe('all')
    expect(resolvePlacePrice('cheap')).toBe('all')
  })
})

describe('isFreePlace', () => {
  it('treats null, zero, and negative fees as free; positive fees as paid', () => {
    expect(isFreePlace({ entryFeeUsd: null })).toBe(true)
    expect(isFreePlace({ entryFeeUsd: 0 })).toBe(true)
    expect(isFreePlace({ entryFeeUsd: -5 })).toBe(true)
    expect(isFreePlace({ entryFeeUsd: 0.01 })).toBe(false)
    expect(isFreePlace({ entryFeeUsd: 37 })).toBe(false)
  })
})

describe('filterPlacesByPrice', () => {
  const free = makePlace({ id: 'free', entryFeeUsd: 0 })
  const freeNull = makePlace({ id: 'freeNull', entryFeeUsd: null })
  const paid = makePlace({ id: 'paid', entryFeeUsd: 10 })
  const places = [free, freeNull, paid]

  it('returns the list unchanged for "all"', () => {
    expect(filterPlacesByPrice(places, 'all')).toEqual(places)
  })

  it('keeps only free places for "free"', () => {
    expect(filterPlacesByPrice(places, 'free').map((p) => p.id)).toEqual(['free', 'freeNull'])
  })

  it('keeps only paid places for "paid"', () => {
    expect(filterPlacesByPrice(places, 'paid').map((p) => p.id)).toEqual(['paid'])
  })

  it('never mutates the input and partitions completely', () => {
    const freeCount = filterPlacesByPrice(places, 'free').length
    const paidCount = filterPlacesByPrice(places, 'paid').length
    expect(freeCount + paidCount).toBe(places.length)
    expect(places).toHaveLength(3)
  })
})

describe('PlaceCard', () => {
  it('renders the name, category badge, and a paid entry fee', () => {
    render(<PlaceCard place={makePlace({ name: 'Bayon Temple', entryFeeUsd: 37 })} />)
    expect(screen.getByText('Bayon Temple')).toBeInTheDocument()
    expect(screen.getByText('Temples')).toBeInTheDocument()
    expect(screen.getByText('$37.00')).toBeInTheDocument()
    expect(screen.getByText('entry')).toBeInTheDocument()
  })

  it('renders a "Free" label when the place has no entry fee', () => {
    render(<PlaceCard place={makePlace({ entryFeeUsd: null })} />)
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.queryByText('entry')).not.toBeInTheDocument()
  })

  it('links to the provided href (e.g. the detail-modal ?place= deep link)', () => {
    render(<PlaceCard place={makePlace({ id: 'p9' })} href="/explore?tab=places&place=p9" />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/explore?tab=places&place=p9')
  })

  it('falls back to /places/<id> when no href is given', () => {
    render(<PlaceCard place={makePlace({ id: 'p9' })} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/places/p9')
  })
})

describe('PlaceGrid', () => {
  it('shows the empty state when there are no places', () => {
    render(<PlaceGrid places={[]} />)
    expect(screen.getByText('No places found')).toBeInTheDocument()
  })

  it('shows the error state when isError is set', () => {
    render(<PlaceGrid places={[]} isError />)
    expect(screen.getByText("Couldn't load places")).toBeInTheDocument()
  })

  it('renders a card per place and uses hrefFor for links', () => {
    render(
      <PlaceGrid
        places={[makePlace({ id: 'a', name: 'Place A' }), makePlace({ id: 'b', name: 'Place B' })]}
        hrefFor={(p) => `/explore?tab=places&place=${p.id}`}
      />,
    )
    expect(screen.getByText('Place A')).toBeInTheDocument()
    expect(screen.getByText('Place B')).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/explore?tab=places&place=a')
  })
})
