import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import TripCardsRenderer from '@/components/vibe-booking/renderers/TripCardsRenderer'
import HotelCardsRenderer from '@/components/vibe-booking/renderers/HotelCardsRenderer'
import { useLanguageStore } from '@/lib/i18n'
import type { ContentItem } from '@/stores/vibe-booking.store'

const mkItem = <T,>(type: string, data: T): ContentItem => ({
  id: `item-${type}`,
  type: type as ContentItem['type'],
  data: data as Record<string, unknown>,
  status: 'ready',
  metadata: {},
  actions: [],
  timestamp: new Date().toISOString(),
})

beforeEach(() => {
  useLanguageStore.setState({ locale: 'en' })
  // Force the no-key fallback so the synced map renders deterministically in jsdom.
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('TripCardsRenderer rich cards + synced map', () => {
  const item = mkItem('trip_cards', {
    trips: [
      {
        id: 't1',
        name: 'Angkor Sunrise',
        durationDays: 1,
        priceUsd: 120,
        rating: 4.8,
        reviewCount: 410,
        blurb: 'Best for **sunrise** lovers.',
        lat: 13.41,
        lng: 103.86,
      },
      { id: 't2', name: 'Battambang Train', durationDays: 1, priceUsd: 80, lat: 13.1, lng: 103.2 },
    ],
  })

  it('renders the rich card with rating, price and blurb', () => {
    render(<TripCardsRenderer item={item} onAction={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Angkor Sunrise' })).toBeInTheDocument()
    expect(screen.getByText('4.8')).toBeInTheDocument()
    expect(screen.getByText('(410)')).toBeInTheDocument()
    expect(screen.getByText('$120.00')).toBeInTheDocument()
    expect(screen.getByText(/sunrise/)).toBeInTheDocument()
    // Both action buttons present
    expect(screen.getAllByRole('button', { name: 'Check availability' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Find more like this' }).length).toBeGreaterThan(0)
  })

  it('renders synced map chips (with price) for trips that have coordinates', () => {
    render(<TripCardsRenderer item={item} onAction={() => {}} />)
    const map = screen.getByTestId('synced-map-fallback')
    expect(within(map).getByRole('button', { name: /Angkor Sunrise/ })).toBeInTheDocument()
    expect(within(map).getByRole('button', { name: /Battambang Train/ })).toBeInTheDocument()
  })

  it('highlights the matching map chip when hovering a card', () => {
    render(<TripCardsRenderer item={item} onAction={() => {}} />)
    const map = screen.getByTestId('synced-map-fallback')
    const chip = within(map).getByRole('button', { name: /Angkor Sunrise/ })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    const card = screen.getByRole('heading', { name: 'Angkor Sunrise' }).closest('article')!
    fireEvent.mouseEnter(card)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  it('fires actions on the card buttons', () => {
    const onAction = vi.fn()
    render(<TripCardsRenderer item={item} onAction={onAction} />)
    const card = screen.getByRole('heading', { name: 'Angkor Sunrise' }).closest('article')!
    fireEvent.click(within(card).getByRole('button', { name: 'Check availability' }))
    expect(onAction).toHaveBeenCalledWith('view_trip_detail', 't1', { tripId: 't1' })
    fireEvent.click(within(card).getByRole('button', { name: 'Find more like this' }))
    expect(onAction).toHaveBeenCalledWith('find_more_like_this', 't1', { name: 'Angkor Sunrise', kind: 'trip' })
  })

  it('renders no map when trips lack coordinates', () => {
    const noCoords = mkItem('trip_cards', {
      trips: [{ id: 't9', name: 'Mystery Trip', durationDays: 2, priceUsd: 99 }],
    })
    render(<TripCardsRenderer item={noCoords} onAction={() => {}} />)
    expect(screen.queryByTestId('synced-map-fallback')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mystery Trip' })).toBeInTheDocument()
  })
})

describe('HotelCardsRenderer rich cards + synced map', () => {
  it('renders a synced map chip per hotel and the blurb', () => {
    const item = mkItem('hotel_cards', {
      hotels: [
        { id: 'h1', name: 'Riverside Hotel', priceUsd: 45, rating: 4.8, blurb: 'Calm **riverfront** stay.', lat: 13.36, lng: 103.85 },
        { id: 'h2', name: 'Beach Resort', priceUsd: 90, lat: 10.6, lng: 103.5 },
      ],
    })
    render(<HotelCardsRenderer item={item} onAction={() => {}} />)
    const map = screen.getByTestId('synced-map-fallback')
    expect(within(map).getByRole('button', { name: /Riverside Hotel/ })).toBeInTheDocument()
    expect(within(map).getByRole('button', { name: /Beach Resort/ })).toBeInTheDocument()
    expect(screen.getByText(/riverfront/)).toBeInTheDocument()
  })
})
