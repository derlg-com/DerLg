import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PayloadBlocks, hasRenderer } from '@/components/chat/payloads/block-renderer'
import { renderWithProviders } from '@/tests/helpers/render'
import type { ContentBlock } from '@/lib/vibe/protocol'

vi.mock('@/lib/i18n/navigation', () => ({
  usePathname: () => '/chat',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

/*
 * The map block pulls in Leaflet, which reads `window` at import time and is loaded
 * through next/dynamic in the app. Stubbed here so the registry can be tested
 * without a real map; the live map is covered by e2e/explore.spec.ts.
 */
vi.mock('@/components/map/leaflet-map', () => ({
  LeafletMap: ({ markers, ariaLabel }: { markers: { id: string }[]; ariaLabel: string }) => (
    <div data-testid="leaflet-map" data-marker-count={markers.length} aria-label={ariaLabel} />
  ),
}))

function renderBlocks(blocks: Record<string, unknown>[], onAsk = vi.fn()) {
  renderWithProviders(
    <PayloadBlocks blocks={blocks as unknown as ContentBlock[]} onAsk={onAsk} />,
  )
  return { onAsk }
}

describe('trip detail block', () => {
  const data = {
    id: 'trip-1',
    name: 'Angkor Temple Discovery',
    priceUsd: 189,
    durationDays: 3,
    description: 'Three unhurried days among the temples.',
    imageUrl: 'http://localhost:9000/derlg/trip-1.jpg',
    included: ['Guide', 'Lunch'],
    excluded: ['Flights'],
    itinerary: [
      { day: 1, title: 'Arrive in Siem Reap', description: 'Check in and rest.' },
      { day: 2, title: 'Angkor Wat at sunrise' },
    ],
  }

  it('renders the name, price and duration', () => {
    renderBlocks([{ type: 'trip_detail', data }])

    expect(screen.getByRole('heading', { name: 'Angkor Temple Discovery' })).toBeInTheDocument()
    expect(screen.getByText(/\$189/)).toBeInTheDocument()
    expect(screen.getByText(/3d/)).toBeInTheDocument()
  })

  it('renders the itinerary as an ordered sequence with localised day labels', () => {
    renderBlocks([{ type: 'trip_detail', data }])

    // catalog.detail.day is the ICU message "Day {number}".
    expect(screen.getByText('Day 1')).toBeInTheDocument()
    expect(screen.getByText('Day 2')).toBeInTheDocument()
    expect(screen.getByText(/Arrive in Siem Reap/)).toBeInTheDocument()
  })

  it('distinguishes what is included from what is not', () => {
    renderBlocks([{ type: 'trip_detail', data }])

    const included = screen.getByRole('list', { name: /what's included/i })
    expect(within(included).getByText('Guide')).toBeInTheDocument()

    const excluded = screen.getByRole('list', { name: /not included/i })
    expect(within(excluded).getByText('Flights')).toBeInTheDocument()
  })

  it('books through the conversation and links to the catalogue', async () => {
    const { onAsk } = renderBlocks([{ type: 'trip_detail', data }])

    expect(screen.getByRole('link', { name: /view details/i })).toHaveAttribute(
      'href',
      '/trips/trip-1',
    )

    await userEvent.click(screen.getByRole('button', { name: /book now/i }))
    expect(onAsk).toHaveBeenCalledWith('Book "Angkor Temple Discovery"')
  })

  it('renders without an itinerary or inclusions', () => {
    renderBlocks([{ type: 'trip_detail', data: { id: 't', name: 'Bare Trip', priceUsd: 50 } }])
    expect(screen.getByRole('heading', { name: 'Bare Trip' })).toBeInTheDocument()
  })
})

describe('hotel detail block', () => {
  const data = {
    id: 'hotel-1',
    name: 'Riverside Boutique',
    priceUsd: 64,
    address: '12 River Road, Siem Reap',
    description: 'Quiet rooms near the old market.',
    amenities: ['Wi-Fi', 'Pool'],
  }

  it('renders the hotel with its address and amenities', () => {
    renderBlocks([{ type: 'hotel_detail', data }])

    expect(screen.getByRole('heading', { name: 'Riverside Boutique' })).toBeInTheDocument()
    expect(screen.getByText('12 River Road, Siem Reap')).toBeInTheDocument()

    const amenities = screen.getByRole('list', { name: /amenities/i })
    expect(within(amenities).getByText('Wi-Fi')).toBeInTheDocument()
  })

  it('asks about availability rather than pretending to book directly', async () => {
    const { onAsk } = renderBlocks([{ type: 'hotel_detail', data }])

    await userEvent.click(screen.getByRole('button', { name: /check availability/i }))
    expect(onAsk).toHaveBeenCalledWith('Is "Riverside Boutique" available?')
  })
})

describe('itinerary block', () => {
  it('lists each day with its activities', () => {
    renderBlocks([
      {
        type: 'itinerary',
        data: {
          days: [
            { day: 1, title: 'Arrival', activities: ['Airport pickup', 'Hotel check-in'] },
            { day: 2, title: 'Temples', activities: ['Angkor Wat'] },
          ],
        },
      },
    ])

    expect(screen.getByText('Day 1', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Airport pickup')).toBeInTheDocument()
    expect(screen.getByText('Angkor Wat')).toBeInTheDocument()
  })

  it('renders a day with no activities', () => {
    renderBlocks([{ type: 'itinerary', data: { days: [{ day: 1, title: 'Free day', activities: [] }] } }])
    expect(screen.getByText(/Free day/)).toBeInTheDocument()
  })

  it('renders nothing for an empty itinerary', () => {
    const { container } = renderWithProviders(
      <PayloadBlocks
        blocks={[{ type: 'itinerary', data: { days: [] } }] as unknown as ContentBlock[]}
        onAsk={vi.fn()}
      />,
    )
    expect(container.textContent).toBe('')
  })
})

describe('image gallery block', () => {
  it('renders captions as figure captions', () => {
    renderBlocks([
      {
        type: 'image_gallery',
        data: {
          images: [
            { url: 'http://x/1.jpg', caption: 'Bayon faces' },
            { url: 'http://x/2.jpg' },
          ],
        },
      },
    ])

    expect(screen.getByAltText('Bayon faces')).toBeInTheDocument()
    expect(screen.getByText('Bayon faces')).toBeInTheDocument()
  })

  it('gives an uncaptioned image a positional alt rather than an empty one', () => {
    // These are content images, so they are not decorative.
    renderBlocks([{ type: 'image_gallery', data: { images: [{ url: 'http://x/2.jpg' }] } }])
    expect(screen.getByAltText(/Gallery 1/i)).toBeInTheDocument()
  })
})

describe('weather block', () => {
  const day = (date: string, high: number, low: number, condition: string) => ({
    date,
    high,
    low,
    condition,
  })

  it('renders each day with a labelled high and low', () => {
    renderBlocks([
      { type: 'weather', data: { forecast: [day('2026-08-02', 33.4, 25.1, 'Sunny')] } },
    ])

    expect(screen.getByText('Sunny')).toBeInTheDocument()
    // Rounded, and the pair is disambiguated for screen readers.
    expect(screen.getByText('33°')).toBeInTheDocument()
    expect(screen.getByText(/high/)).toBeInTheDocument()
    expect(screen.getByText(/low/)).toBeInTheDocument()
  })

  it('uses the five-day heading only when there are five or more days', () => {
    const five = Array.from({ length: 5 }, (_, i) =>
      day(`2026-08-0${i + 2}`, 33, 25, 'Sunny'),
    )
    renderBlocks([{ type: 'weather', data: { forecast: five } }])
    expect(screen.getByRole('heading', { name: /5-day forecast/i })).toBeInTheDocument()
  })

  it('falls back to the plain weather heading for a short forecast', () => {
    renderBlocks([{ type: 'weather', data: { forecast: [day('2026-08-02', 33, 25, 'Sunny')] } }])
    expect(screen.getByRole('heading', { name: /^weather$/i })).toBeInTheDocument()
  })

  it('shows the raw value when the date is not parseable', () => {
    renderBlocks([{ type: 'weather', data: { forecast: [day('tomorrow', 33, 25, 'Rain')] } }])
    expect(screen.getByText('tomorrow')).toBeInTheDocument()
  })
})

describe('budget estimate block', () => {
  it('renders the breakdown as label/amount pairs plus a total', () => {
    renderBlocks([
      {
        type: 'budget_estimate',
        data: {
          totalUsd: 480,
          breakdown: { accommodation: 200, food_drink: 120, local_transport: 60 },
        },
      },
    ])

    // The four known categories have real translations.
    expect(screen.getByText('Accommodation')).toBeInTheDocument()
    expect(screen.getByText('Food & Drink')).toBeInTheDocument()
    expect(screen.getByText('Local Transport')).toBeInTheDocument()
    expect(screen.getByText(/\$480/)).toBeInTheDocument()
  })

  it('humanises an unknown category instead of showing a raw key', () => {
    renderBlocks([
      { type: 'budget_estimate', data: { totalUsd: 50, breakdown: { visa_fees: 50 } } },
    ])
    expect(screen.getByText('Visa fees')).toBeInTheDocument()
  })

  it('renders a total with no breakdown at all', () => {
    renderBlocks([{ type: 'budget_estimate', data: { totalUsd: 100, breakdown: {} } }])
    expect(screen.getByText(/\$100/)).toBeInTheDocument()
  })
})

describe('text summary block', () => {
  it('renders the summary text', () => {
    renderBlocks([
      { type: 'text_summary', data: { text: 'Three days is enough for the main temples.' } },
    ])
    expect(screen.getByText('Three days is enough for the main temples.')).toBeInTheDocument()
  })

  it('renders nothing for whitespace-only text', () => {
    const { container } = renderWithProviders(
      <PayloadBlocks
        blocks={[{ type: 'text_summary', data: { text: '   ' } }] as unknown as ContentBlock[]}
        onAsk={vi.fn()}
      />,
    )
    expect(container.textContent).toBe('')
  })
})

describe('map view block', () => {
  it('renders a map with one marker per coordinate', async () => {
    renderBlocks([
      {
        type: 'map_view',
        data: {
          center: { lat: 13.41, lng: 103.86 },
          markers: [
            { id: 'm1', lat: 13.41, lng: 103.86, label: 'Angkor Wat', type: 'trip' },
            { id: 'm2', lat: 13.35, lng: 103.85, label: 'Riverside', type: 'hotel' },
          ],
        },
      },
    ])

    // next/dynamic(ssr:false) loads the map lazily, so await its arrival.
    const map = await screen.findByTestId('leaflet-map')
    expect(map).toHaveAttribute('data-marker-count', '2')
    expect(map).toHaveAccessibleName(/map/i)
  })

  it('renders nothing when there is nothing mappable', () => {
    // The cards already carry the detail, so an empty map would be noise.
    const { container } = renderWithProviders(
      <PayloadBlocks
        blocks={
          [
            { type: 'map_view', data: { center: { lat: 0, lng: 0 }, markers: [] } },
          ] as unknown as ContentBlock[]
        }
        onAsk={vi.fn()}
      />,
    )
    expect(container.textContent).toBe('')
  })
})

describe('registry coverage after rich renderers', () => {
  it('renders every rich type', () => {
    for (const type of [
      'trip_detail',
      'hotel_detail',
      'itinerary',
      'image_gallery',
      'map_view',
      'weather',
      'budget_estimate',
      'text_summary',
    ]) {
      expect(hasRenderer(type)).toBe(true)
    }
  })

  it('renders the booking types too, so the registry is complete', () => {
    for (const type of [
      'booking_summary',
      'booking_confirmed',
      'qr_payment',
      'stripe_card_form',
      'payment_status',
    ]) {
      expect(hasRenderer(type)).toBe(true)
    }
  })

  it('renders a multi-block turn combining cards, weather and a map', async () => {
    renderBlocks([
      {
        type: 'trip_cards',
        data: { trips: [{ id: 'trip-1', name: 'Angkor Discovery', priceUsd: 189 }] },
      },
      { type: 'weather', data: { forecast: [{ date: '2026-08-02', high: 33, low: 25, condition: 'Sunny' }] } },
      {
        type: 'map_view',
        data: {
          center: { lat: 13.41, lng: 103.86 },
          markers: [{ id: 'm1', lat: 13.41, lng: 103.86, label: 'Angkor Wat' }],
        },
      },
    ])

    // This is the shape of a real multi-tool turn.
    expect(screen.getByText('Angkor Discovery')).toBeInTheDocument()
    expect(screen.getByText('Sunny')).toBeInTheDocument()
    expect(await screen.findByTestId('leaflet-map')).toBeInTheDocument()
  })
})
