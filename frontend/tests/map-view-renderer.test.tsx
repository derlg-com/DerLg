import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import MapViewRenderer from '@/components/vibe-booking/renderers/MapViewRenderer'
import { useLanguageStore } from '@/lib/i18n'
import type { ContentItem } from '@/stores/vibe-booking.store'

/**
 * Task 17.3 — lazy-load map tiles with offline fallback.
 *
 * In jsdom `IntersectionObserver` is mocked with a no-op `observe`, so the map
 * never scrolls "into view" and the heavy Google Maps tile layer is never
 * mounted. That makes these tests exercise the graceful fallback path, which is
 * exactly the offline-first behaviour we care about here.
 */

const mkItem = (data: Record<string, unknown>): ContentItem => ({
  id: 'item-map_view',
  type: 'map_view' as ContentItem['type'],
  data,
  status: 'ready',
  metadata: {},
  actions: [],
  timestamp: new Date().toISOString(),
})

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

afterEach(() => {
  setNavigatorOnline(true)
})

const PHNOM = { lat: 11.5564, lng: 104.9282 }
const ANGKOR = { lat: 13.4125, lng: 103.867 }

describe('MapViewRenderer', () => {
  it('renders a graceful fallback (location + coordinates) instead of broken tiles', () => {
    useLanguageStore.setState({ locale: 'en' })
    const item = mkItem({
      center: PHNOM,
      markers: [{ id: 'm1', lat: ANGKOR.lat, lng: ANGKOR.lng, label: 'Angkor Wat' }],
    })
    render(<MapViewRenderer item={item} onAction={() => {}} />)

    const fallback = screen.getByTestId('map-fallback')
    expect(fallback).toBeInTheDocument()
    // Location name and coordinates give the user useful context.
    expect(screen.getByText('Angkor Wat')).toBeInTheDocument()
    expect(screen.getByText(/13\.4125, 103\.8670/)).toBeInTheDocument()
  })

  it('shows the offline message when the device is offline', () => {
    useLanguageStore.setState({ locale: 'en' })
    setNavigatorOnline(false)
    const item = mkItem({ center: ANGKOR, markers: [] })

    act(() => {
      render(<MapViewRenderer item={item} onAction={() => {}} />)
      window.dispatchEvent(new Event('offline'))
    })

    expect(screen.getByText('Map unavailable offline.')).toBeInTheDocument()
  })

  it('renders the localized distance-from-Phnom-Penh hint', () => {
    useLanguageStore.setState({ locale: 'en' })
    const item = mkItem({ center: ANGKOR, markers: [] })
    render(<MapViewRenderer item={item} onAction={() => {}} />)

    // ~230 km between Phnom Penh and Angkor Wat — assert the localized template
    // rendered with a number rather than a raw i18n key.
    expect(screen.getByText(/km from Phnom Penh/i)).toBeInTheDocument()
  })

  it('localizes the fallback for Khmer', () => {
    useLanguageStore.setState({ locale: 'km' })
    setNavigatorOnline(false)
    const item = mkItem({ center: ANGKOR, markers: [] })

    act(() => {
      render(<MapViewRenderer item={item} onAction={() => {}} />)
      window.dispatchEvent(new Event('offline'))
    })

    expect(screen.getByText('ផែនទីមិនអាចប្រើបានពេលគ្មានអ៊ីនធឺណិត។')).toBeInTheDocument()
  })
})
