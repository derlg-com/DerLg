import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useLanguageStore } from '@/lib/i18n'
import type { ApiQueryResult } from '@/lib/use-api-query'
import type { Paginated } from '@/types/api'
import type { FestivalSummary, PlaceSummary } from '@/types/domain'

// next/navigation: the tab reads the current path/query to build `?place=`
// deep links that preserve the active tab/filters.
let searchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  usePathname: () => '/explore',
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
}))

// Data hooks — stub the loaded pages.
const usePlaces = vi.fn()
const useFestivals = vi.fn()
vi.mock('@/hooks/use-places', () => ({ usePlaces: (...a: unknown[]) => usePlaces(...a) }))
vi.mock('@/hooks/use-festivals', () => ({ useFestivals: (...a: unknown[]) => useFestivals(...a) }))

// Capture what BaseMap receives so we can assert the markers are passed as
// children, and exercise the no-key fallback branch.
vi.mock('@/components/shared/BaseMap', () => ({
  BaseMap: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="base-map">{children}</div>
  ),
}))

// The marker layer needs the Maps SDK; stub it to render the marker titles so
// we can confirm the tab built markers from both data sources.
vi.mock('@/components/explore/ExploreMapMarkers', () => ({
  ExploreMapMarkers: ({ markers }: { markers: { id: string; title: string }[] }) => (
    <div data-testid="markers">{markers.map((m) => m.title).join(',')}</div>
  ),
}))

import { ExploreMapTab } from '@/components/explore/ExploreMapTab'

function paged<T>(items: T[]): ApiQueryResult<Paginated<T>> {
  return {
    data: { items, total: items.length, page: 1, limit: 50, totalPages: 1 } as Paginated<T>,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  }
}

const places: PlaceSummary[] = [
  {
    id: 'p1',
    name: 'Angkor Wat',
    category: 'temple',
    latitude: 13.41,
    longitude: 103.86,
    entryFeeUsd: 37,
    coverImage: null,
  },
]

const festivalWithCoords = {
  id: 'f1',
  name: 'Water Festival',
  startDate: '2026-11-14',
  endDate: '2026-11-16',
  province: 'Phnom Penh',
  location: null,
  coverImage: null,
  latitude: 11.56,
  longitude: 104.93,
} as FestivalSummary

beforeEach(() => {
  useLanguageStore.setState({ locale: 'en' })
  usePlaces.mockReturnValue(paged(places))
  useFestivals.mockReturnValue(paged([festivalWithCoords]))
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  searchParams = new URLSearchParams()
})

describe('ExploreMapTab (task 9.2, Req 4.4, 11.8)', () => {
  it('builds markers from both places and festivals and passes them into BaseMap', () => {
    render(<ExploreMapTab />)
    const markers = screen.getByTestId('markers')
    expect(markers).toHaveTextContent('Angkor Wat')
    expect(markers).toHaveTextContent('Water Festival')
  })

  it('captures the user location when the geolocation button is clicked', () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({ coords: { latitude: 11.5, longitude: 104.9 } } as GeolocationPosition),
    )
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    render(<ExploreMapTab />)
    fireEvent.click(screen.getByRole('button', { name: /Show my location/ }))
    expect(getCurrentPosition).toHaveBeenCalled()
  })

  it('shows an error when geolocation is denied', () => {
    const getCurrentPosition = vi.fn((_s: PositionCallback, error: PositionErrorCallback) =>
      error({ code: 1, message: 'denied' } as GeolocationPositionError),
    )
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    render(<ExploreMapTab />)
    fireEvent.click(screen.getByRole('button', { name: /Show my location/ }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders a list fallback (linking to detail surfaces) when no Maps key is set', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', '')
    render(<ExploreMapTab />)
    const list = screen.getByTestId('explore-map-list')
    expect(list).toBeInTheDocument()
    // Place links to the `?place=` modal; festival links to its page.
    expect(screen.getByRole('link', { name: /Angkor Wat/ })).toHaveAttribute(
      'href',
      '/explore?place=p1',
    )
    expect(screen.getByRole('link', { name: /Water Festival/ })).toHaveAttribute(
      'href',
      '/festivals/f1',
    )
  })

  it('hides the list fallback when a Maps key is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'test-key')
    render(<ExploreMapTab />)
    expect(screen.queryByTestId('explore-map-list')).not.toBeInTheDocument()
  })
})

describe('ExploreMapTab offline map support (task 9.3, Req 11)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists loaded markers to the offline cache for later reuse', async () => {
    const { loadOfflineMapMarkers } = await import('@/lib/offline-map-cache')
    render(<ExploreMapTab />)
    // Live data (Angkor Wat + Water Festival) should be written to localStorage.
    const cached = loadOfflineMapMarkers()
    expect(cached.map((m) => m.title).sort()).toEqual(['Angkor Wat', 'Water Festival'])
  })

  it('falls back to cached locations with an offline note when live data is empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'test-key')
    const { saveOfflineMapMarkers } = await import('@/lib/offline-map-cache')
    saveOfflineMapMarkers([
      {
        id: 'place:cached',
        kind: 'place',
        entityId: 'cached',
        position: { lat: 13.4, lng: 103.8 },
        title: 'Cached Temple',
        category: 'temple',
        entryFeeUsd: null,
      },
    ])
    // Simulate offline: live queries return no data.
    usePlaces.mockReturnValue({ data: null, error: null, isLoading: false, refetch: vi.fn() })
    useFestivals.mockReturnValue({ data: null, error: null, isLoading: false, refetch: vi.fn() })

    render(<ExploreMapTab />)
    expect(screen.getByTestId('offline-map-note')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Cached Temple/ })).toBeInTheDocument()
  })

  it('does not show the offline list when live data is available (even with a key)', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'test-key')
    render(<ExploreMapTab />)
    expect(screen.queryByTestId('offline-map-note')).not.toBeInTheDocument()
    expect(screen.queryByTestId('explore-map-list')).not.toBeInTheDocument()
  })
})
