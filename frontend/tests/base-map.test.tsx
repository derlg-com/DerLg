import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useLanguageStore } from '@/lib/i18n'

// Mock the Google Maps SDK so the "with key" branch renders deterministically
// in jsdom (the real SDK injects scripts and touches browser globals).
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="api-provider">{children}</div>
  ),
  Map: ({ children }: { children: React.ReactNode }) => <div data-testid="gmap">{children}</div>,
}))

// Imported after the mock so the component picks up the mocked SDK.
import { BaseMap, hasMapsApiKey, getMapsApiKey } from '@/components/shared/BaseMap'

beforeEach(() => {
  useLanguageStore.setState({ locale: 'en' })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('BaseMap fallback (no API key)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', '')
  })

  it('renders an accessible fallback when no API key is configured', () => {
    render(<BaseMap />)
    const fallback = screen.getByTestId('base-map-fallback')
    expect(fallback).toBeInTheDocument()
    expect(fallback).toHaveAttribute('role', 'status')
    // Does NOT mount the Google Map.
    expect(screen.queryByTestId('gmap')).not.toBeInTheDocument()
  })

  it('uses a custom fallback label when provided', () => {
    render(<BaseMap fallbackLabel="Map off" />)
    expect(screen.getByLabelText('Map off')).toBeInTheDocument()
    expect(screen.getByText('Map off')).toBeInTheDocument()
  })

  it('reports no API key via helpers', () => {
    expect(getMapsApiKey()).toBe('')
    expect(hasMapsApiKey()).toBe(false)
  })
})

describe('BaseMap render (with API key)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'test-key')
  })

  it('mounts the Google Map and renders children when a key is configured', () => {
    render(
      <BaseMap>
        <div data-testid="child-marker">marker</div>
      </BaseMap>,
    )
    expect(screen.getByTestId('api-provider')).toBeInTheDocument()
    expect(screen.getByTestId('gmap')).toBeInTheDocument()
    expect(screen.getByTestId('child-marker')).toBeInTheDocument()
    // No fallback when the map is available.
    expect(screen.queryByTestId('base-map-fallback')).not.toBeInTheDocument()
  })

  it('reports an API key via helpers', () => {
    expect(hasMapsApiKey()).toBe(true)
  })
})
