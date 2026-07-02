import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ApiQueryResult } from '@/lib/use-api-query'
import type { FestivalDetail } from '@/types/domain'

// Drive the detail view through the project's server-state layer (the React
// Query equivalent) by mocking useApiQuery — same pattern as explore-landing.
const useApiQuery = vi.fn()
vi.mock('@/lib/use-api-query', () => ({
  useApiQuery: (...args: unknown[]) => useApiQuery(...args),
}))

// The gallery uses a portal/Image; stub it so this suite focuses on the
// festival's name, date range, location and description (Req 3.3).
vi.mock('@/components/trips/TripGallery', () => ({
  TripGallery: ({ images }: { images: string[] }) => (
    <div data-testid="gallery">{images.length}</div>
  ),
}))

import { FestivalDetailView } from '@/components/festivals/FestivalDetailView'

const festival: FestivalDetail = {
  id: 'fest-1',
  name: 'Water Festival',
  startDate: '2026-11-14',
  endDate: '2026-11-16',
  province: 'Phnom Penh',
  location: 'Riverside',
  coverImage: null,
  description: 'Bon Om Touk celebrates the reversal of the Tonle Sap river.',
  images: ['a.jpg', 'b.jpg'],
}

function result(over: Partial<ApiQueryResult<FestivalDetail>>): ApiQueryResult<FestivalDetail> {
  return { data: null, error: null, isLoading: false, refetch: vi.fn(), ...over }
}

describe('FestivalDetailView (Req 3.3)', () => {
  beforeEach(() => useApiQuery.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('fetches the festival by id through the query layer', () => {
    useApiQuery.mockReturnValue(result({ isLoading: true }))
    render(<FestivalDetailView id="fest-1" />)
    expect(String(useApiQuery.mock.calls[0][0])).toBe('/v1/festivals/fest-1')
  })

  it('shows a loading skeleton while fetching', () => {
    useApiQuery.mockReturnValue(result({ isLoading: true }))
    const { container } = render(<FestivalDetailView id="fest-1" />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText('Water Festival')).not.toBeInTheDocument()
  })

  it('renders name, date range, location, gallery and description', () => {
    useApiQuery.mockReturnValue(result({ data: festival }))
    render(<FestivalDetailView id="fest-1" />)
    expect(screen.getByRole('heading', { name: 'Water Festival' })).toBeInTheDocument()
    // Locale-aware range with en-US short dates.
    expect(screen.getByText(/Nov 14, 2026.*Nov 16, 2026/)).toBeInTheDocument()
    expect(screen.getByText('Riverside')).toBeInTheDocument()
    expect(screen.getByText(/Bon Om Touk celebrates/)).toBeInTheDocument()
    expect(screen.getByTestId('gallery')).toHaveTextContent('2')
  })

  it('collapses an identical start/end date into a single value', () => {
    useApiQuery.mockReturnValue(
      result({ data: { ...festival, startDate: '2026-11-14', endDate: '2026-11-14' } }),
    )
    render(<FestivalDetailView id="fest-1" />)
    expect(screen.getByText('Nov 14, 2026')).toBeInTheDocument()
  })

  it('shows a not-found message on 404', () => {
    useApiQuery.mockReturnValue(
      result({ error: Object.assign(new Error('nope'), { status: 404 }) as never }),
    )
    render(<FestivalDetailView id="missing" />)
    expect(screen.getByText('Festival not found')).toBeInTheDocument()
  })

  it('shows a retry error state on server failure', () => {
    useApiQuery.mockReturnValue(
      result({ error: Object.assign(new Error('boom'), { status: 500 }) as never }),
    )
    render(<FestivalDetailView id="fest-1" />)
    expect(screen.getByText("Couldn't load festival")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
