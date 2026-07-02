import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ApiQueryResult } from '@/lib/use-api-query'
import type { PlaceDetail } from '@/types/domain'

// The place detail modal (task 8.5, Requirement 4.6) is URL-driven: it opens
// when `?place=<id>` is present, fetches GET /v1/places/:id through the shared
// query layer, and closing removes only the `?place=` param (preserving tab,
// filters, search and paging). We drive the navigation + query layers via mocks
// — same pattern as festival-detail / explore-tabs.

const replace = vi.fn()
let searchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/explore',
  useSearchParams: () => searchParams,
}))

const useApiQuery = vi.fn()
vi.mock('@/lib/use-api-query', () => ({
  useApiQuery: (...args: unknown[]) => useApiQuery(...args),
}))

// The gallery uses a portal + next/image; stub it so this suite focuses on the
// place's information and the modal's open/close + URL behaviour.
vi.mock('@/components/trips/TripGallery', () => ({
  TripGallery: ({ images }: { images: string[] }) => (
    <div data-testid="gallery">{images.length}</div>
  ),
}))

import { PlaceDetailModal } from '@/components/explore/PlaceDetailModal'

const place: PlaceDetail = {
  id: 'place-1',
  name: 'Angkor Wat',
  description: 'The largest religious monument in the world.',
  category: 'temple',
  latitude: 13.4125,
  longitude: 103.867,
  entryFeeUsd: 37,
  openingHours: '5:00 AM – 6:00 PM',
  dressCode: 'Cover shoulders and knees',
  website: 'https://example.com/angkor',
  visitorTips: 'Arrive before sunrise.',
  address: 'Krong Siem Reap, Cambodia',
  images: ['a.jpg', 'b.jpg'],
}

function result(over: Partial<ApiQueryResult<PlaceDetail>>): ApiQueryResult<PlaceDetail> {
  return { data: null, error: null, isLoading: false, refetch: vi.fn(), ...over }
}

describe('PlaceDetailModal (Req 4.6)', () => {
  beforeEach(() => {
    useApiQuery.mockReset()
    replace.mockClear()
    searchParams = new URLSearchParams()
  })
  afterEach(() => vi.clearAllMocks())

  it('does not fetch or render a dialog when no ?place= is present', () => {
    useApiQuery.mockReturnValue(result({}))
    render(<PlaceDetailModal />)
    // path passed to useApiQuery should be null (fetch disabled).
    expect(useApiQuery.mock.calls[0][0]).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens and fetches the place by id when ?place=<id> is present', () => {
    searchParams = new URLSearchParams('place=place-1')
    useApiQuery.mockReturnValue(result({ isLoading: true }))
    render(<PlaceDetailModal />)
    expect(String(useApiQuery.mock.calls[0][0])).toBe('/v1/places/place-1')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows a loading skeleton while fetching', () => {
    searchParams = new URLSearchParams('place=place-1')
    useApiQuery.mockReturnValue(result({ isLoading: true }))
    render(<PlaceDetailModal />)
    expect(screen.getByTestId('place-modal-loading')).toBeInTheDocument()
    expect(screen.queryByText('Angkor Wat')).not.toBeInTheDocument()
  })

  it('renders the full place detail (name, category, fee, hours, tips, gallery)', () => {
    searchParams = new URLSearchParams('place=place-1')
    useApiQuery.mockReturnValue(result({ data: place }))
    render(<PlaceDetailModal />)
    expect(screen.getByRole('heading', { name: 'Angkor Wat' })).toBeInTheDocument()
    expect(screen.getByText('Temple')).toBeInTheDocument()
    expect(screen.getByText('$37.00')).toBeInTheDocument()
    expect(screen.getByText('5:00 AM – 6:00 PM')).toBeInTheDocument()
    expect(screen.getByText('Arrive before sunrise.')).toBeInTheDocument()
    expect(screen.getByText('Krong Siem Reap, Cambodia')).toBeInTheDocument()
    expect(screen.getByText(/largest religious monument/)).toBeInTheDocument()
    expect(screen.getByTestId('gallery')).toHaveTextContent('2')
  })

  it('renders a directions CTA linking to the map location and a website CTA', () => {
    searchParams = new URLSearchParams('place=place-1')
    useApiQuery.mockReturnValue(result({ data: place }))
    render(<PlaceDetailModal />)
    const directions = screen.getByRole('link', { name: /Get directions/ })
    expect(directions).toHaveAttribute('href', expect.stringContaining('13.4125'))
    expect(directions).toHaveAttribute('href', expect.stringContaining('103.867'))
    expect(screen.getByRole('link', { name: /Visit website/ })).toHaveAttribute(
      'href',
      'https://example.com/angkor',
    )
  })

  it('shows "Free" when the place has no entry fee', () => {
    searchParams = new URLSearchParams('place=place-1')
    useApiQuery.mockReturnValue(result({ data: { ...place, entryFeeUsd: null } }))
    render(<PlaceDetailModal />)
    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  it('clears only the ?place= param on close, preserving tab/filters/search/page', () => {
    searchParams = new URLSearchParams('tab=places&category=temple&q=angkor&page=2&place=place-1')
    useApiQuery.mockReturnValue(result({ data: place }))
    render(<PlaceDetailModal />)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(replace).toHaveBeenCalledTimes(1)
    const target = replace.mock.calls[0][0] as string
    expect(target).not.toContain('place=')
    expect(target).toContain('tab=places')
    expect(target).toContain('category=temple')
    expect(target).toContain('q=angkor')
    expect(target).toContain('page=2')
  })

  it('clears the param on Escape key', () => {
    searchParams = new URLSearchParams('place=place-1')
    useApiQuery.mockReturnValue(result({ data: place }))
    render(<PlaceDetailModal />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(replace).toHaveBeenCalledWith('/explore')
  })

  it('shows a not-found message on 404 (no retry)', () => {
    searchParams = new URLSearchParams('place=missing')
    useApiQuery.mockReturnValue(
      result({ error: Object.assign(new Error('nope'), { status: 404 }) as never }),
    )
    render(<PlaceDetailModal />)
    expect(screen.getByText('Place not found')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('shows a retry error state on server failure', () => {
    searchParams = new URLSearchParams('place=place-1')
    const refetch = vi.fn()
    useApiQuery.mockReturnValue(
      result({ error: Object.assign(new Error('boom'), { status: 500 }) as never, refetch }),
    )
    render(<PlaceDetailModal />)
    expect(screen.getByText("Couldn't load place")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalled()
  })
})
