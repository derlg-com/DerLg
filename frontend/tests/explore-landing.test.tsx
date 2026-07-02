import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ApiQueryResult } from '@/lib/use-api-query'
import type { Paginated } from '@/types/api'
import type { TripSummary } from '@/types/catalog'

// Mock the project's server-state layer (the React Query equivalent) so we can
// drive the featured-trips shelf through its loading / loaded / error states.
const useApiQuery = vi.fn()
vi.mock('@/lib/use-api-query', () => ({
  useApiQuery: (...args: unknown[]) => useApiQuery(...args),
}))

// Non-trip shelves are exercised elsewhere; stub them so this suite focuses on
// featured trips (Requirements 3.2, 3.8, 3.9).
vi.mock('@/components/explore/search-hero', () => ({ SearchHero: () => null }))
vi.mock('@/components/explore/category-tiles', () => ({ CategoryTiles: () => null }))

import { ExploreLanding } from '@/components/explore/explore-landing'
import { useFavoritesStore } from '@/stores/favorites.store'

const featuredTrip: TripSummary = {
  id: 't1',
  slug: 'angkor-wat-sunrise',
  name: 'Angkor Wat Sunrise',
  coverImageUrl: null,
  durationDays: 3,
  priceUsd: 49,
  category: 'Temples',
  location: 'Siem Reap',
  ratingAverage: 4.8,
  ratingCount: 120,
  isFeatured: true,
}

function result<T>(over: Partial<ApiQueryResult<T>>): ApiQueryResult<T> {
  return { data: null, error: null, isLoading: false, refetch: vi.fn(), ...over }
}

const empty = <T,>() =>
  result<Paginated<T>>({ data: { items: [], total: 0, page: 1, limit: 10, totalPages: 0 } })

/** Route mock results by request path so only the trips shelf is meaningful. */
function mockByPath(tripsResult: ApiQueryResult<Paginated<TripSummary>>) {
  useApiQuery.mockImplementation((path: string) => {
    if (path.startsWith('/v1/trips')) return tripsResult
    return empty()
  })
}

describe('ExploreLanding — featured trips', () => {
  beforeEach(() => {
    useFavoritesStore.setState({ ids: [] })
    useApiQuery.mockReset()
  })
  afterEach(() => vi.clearAllMocks())

  it('requests featured trips through the query layer (Req 3.2)', () => {
    mockByPath(empty())
    render(<ExploreLanding />)
    const tripCall = useApiQuery.mock.calls.find((c) => String(c[0]).startsWith('/v1/trips'))
    expect(tripCall).toBeDefined()
    expect(String(tripCall![0])).toContain('sort=featured')
  })

  it('shows loading skeletons while fetching (Req 3.9)', () => {
    mockByPath(result<Paginated<TripSummary>>({ isLoading: true }))
    const { container } = render(<ExploreLanding />)
    // The "Popular trips" header renders even while loading; cards do not yet.
    expect(screen.getByText('Popular trips')).toBeInTheDocument()
    expect(screen.queryByText('Angkor Wat Sunrise')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders a card per featured trip with title, price and duration (Req 3.2)', () => {
    mockByPath(
      result<Paginated<TripSummary>>({
        data: { items: [featuredTrip], total: 1, page: 1, limit: 10, totalPages: 1 },
      }),
    )
    render(<ExploreLanding />)
    expect(screen.getByText('Angkor Wat Sunrise')).toBeInTheDocument()
    expect(screen.getByText('$49.00')).toBeInTheDocument()
    expect(screen.getByText('3 days')).toBeInTheDocument()
    // Card links to the trip detail page (navigation on click).
    expect(
      screen.getByRole('link', { name: /Angkor Wat Sunrise/i }).getAttribute('href'),
    ).toContain('/trips/angkor-wat-sunrise')
  })

  it('exposes a "See all" link to the paginated trips catalog (Req 3.8)', () => {
    mockByPath(
      result<Paginated<TripSummary>>({
        data: { items: [featuredTrip], total: 1, page: 1, limit: 10, totalPages: 1 },
      }),
    )
    render(<ExploreLanding />)
    const seeAll = screen.getAllByRole('link').find((a) => a.getAttribute('href') === '/trips')
    expect(seeAll).toBeDefined()
  })

  it('hides the trips shelf on error instead of rendering a broken section', () => {
    mockByPath(
      result<Paginated<TripSummary>>({
        error: Object.assign(new Error('boom'), { status: 500 }) as never,
      }),
    )
    render(<ExploreLanding />)
    expect(screen.queryByText('Popular trips')).not.toBeInTheDocument()
    expect(screen.queryByText('Angkor Wat Sunrise')).not.toBeInTheDocument()
  })
})
