import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useLanguageStore } from '@/lib/i18n'
import type { ExploreMarker } from '@/lib/explore-map'

// Mock the Google Maps SDK so markers/InfoWindow render deterministically in
// jsdom (same approach as base-map.test). AdvancedMarker exposes its onClick so
// we can simulate a marker click; InfoWindow simply renders its children.
const fitBounds = vi.fn()
const setCenter = vi.fn()
const setZoom = vi.fn()

vi.mock('@vis.gl/react-google-maps', () => ({
  useMap: () => ({ fitBounds, setCenter, setZoom }),
  AdvancedMarker: ({
    children,
    onClick,
    title,
  }: {
    children?: React.ReactNode
    onClick?: () => void
    title?: string
  }) => (
    <button type="button" data-testid="marker" aria-label={title} onClick={onClick}>
      {children}
    </button>
  ),
  InfoWindow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="info-window">{children}</div>
  ),
  Pin: () => <span data-testid="pin" />,
}))

import { ExploreMapMarkers } from '@/components/explore/ExploreMapMarkers'

const markers: ExploreMarker[] = [
  {
    id: 'place:p1',
    kind: 'place',
    entityId: 'p1',
    position: { lat: 13.41, lng: 103.86 },
    title: 'Angkor Wat',
    category: 'temple',
    entryFeeUsd: 37,
  },
  {
    id: 'place:p2',
    kind: 'place',
    entityId: 'p2',
    position: { lat: 11.55, lng: 104.92 },
    title: 'Royal Palace',
    category: 'landmark',
    entryFeeUsd: null,
  },
  {
    id: 'festival:f1',
    kind: 'festival',
    entityId: 'f1',
    position: { lat: 11.56, lng: 104.93 },
    title: 'Water Festival',
  },
]

const hrefFor = (m: ExploreMarker) =>
  m.kind === 'festival' ? `/festivals/${m.entityId}` : `/explore?place=${m.entityId}`

beforeEach(() => {
  useLanguageStore.setState({ locale: 'en' })
  fitBounds.mockClear()
  setCenter.mockClear()
  setZoom.mockClear()
})

afterEach(() => vi.clearAllMocks())

describe('ExploreMapMarkers (task 9.2, Req 4.4)', () => {
  it('renders one marker per place/festival', () => {
    render(<ExploreMapMarkers markers={markers} hrefFor={hrefFor} />)
    expect(screen.getAllByTestId('marker')).toHaveLength(3)
    expect(screen.getByLabelText('Angkor Wat')).toBeInTheDocument()
    expect(screen.getByLabelText('Water Festival')).toBeInTheDocument()
  })

  it('fits the viewport to all markers on render', () => {
    render(<ExploreMapMarkers markers={markers} hrefFor={hrefFor} />)
    expect(fitBounds).toHaveBeenCalledTimes(1)
    expect(fitBounds.mock.calls[0][0]).toEqual({
      south: 11.55,
      west: 103.86,
      north: 13.41,
      east: 104.93,
    })
  })

  it('centers (not fits) when there is a single marker', () => {
    render(<ExploreMapMarkers markers={[markers[0]]} hrefFor={hrefFor} />)
    expect(setCenter).toHaveBeenCalledWith(markers[0].position)
    expect(setZoom).toHaveBeenCalledWith(12)
    expect(fitBounds).not.toHaveBeenCalled()
  })

  it('opens an InfoWindow with name, category, fee and a details CTA on click', () => {
    render(<ExploreMapMarkers markers={markers} hrefFor={hrefFor} />)
    expect(screen.queryByTestId('info-window')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Angkor Wat'))

    const info = screen.getByTestId('explore-info-window')
    expect(info).toHaveTextContent('Angkor Wat')
    expect(info).toHaveTextContent('Temple')
    expect(info).toHaveTextContent('$37.00')
    const cta = screen.getByRole('link', { name: /View details/ })
    expect(cta).toHaveAttribute('href', '/explore?place=p1')
  })

  it('shows "Free" for a place with no entry fee', () => {
    render(<ExploreMapMarkers markers={markers} hrefFor={hrefFor} />)
    fireEvent.click(screen.getByLabelText('Royal Palace'))
    expect(screen.getByTestId('explore-info-window')).toHaveTextContent('Free')
  })

  it('links festivals to their standalone page and omits the fee', () => {
    render(<ExploreMapMarkers markers={markers} hrefFor={hrefFor} />)
    fireEvent.click(screen.getByLabelText('Water Festival'))
    const info = screen.getByTestId('explore-info-window')
    expect(info).toHaveTextContent('Festival')
    expect(info).not.toHaveTextContent('$')
    expect(screen.getByRole('link', { name: /View details/ })).toHaveAttribute(
      'href',
      '/festivals/f1',
    )
  })

  it('renders a user-location marker when a location is provided', () => {
    render(
      <ExploreMapMarkers
        markers={markers}
        hrefFor={hrefFor}
        userLocation={{ lat: 11.5, lng: 104.9 }}
      />,
    )
    expect(screen.getByLabelText('You are here')).toBeInTheDocument()
  })
})
