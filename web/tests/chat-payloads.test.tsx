import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  PayloadBlocks,
  UnrenderedBlock,
  hasRenderer,
} from '@/components/chat/payloads/block-renderer'
import { renderWithProviders } from '@/tests/helpers/render'
import type { ContentBlock } from '@/lib/vibe/protocol'

/*
 * The locale router cannot be imported under vitest (next-intl reaches for
 * 'next/navigation' without an extension). Mocked here following the same pattern
 * as tests/shell.test.tsx; the real locale prefixing is asserted in e2e instead.
 */
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

const trip = {
  id: 'trip-1',
  name: 'Angkor Temple Discovery',
  blurb: 'Three days among the temples.',
  province: 'Siem Reap',
  durationDays: 3,
  priceUsd: 189,
  imageUrl: 'http://localhost:9000/derlg/trip-1.jpg',
}

const hotel = {
  id: 'hotel-1',
  name: 'Riverside Boutique',
  address: '12 River Road',
  priceUsd: 64,
  amenities: ['Wi-Fi', 'Pool', 'Breakfast', 'Spa'],
}

const guide = {
  id: 'guide-1',
  name: 'Sokha P.',
  pricePerDayUsd: 45,
  languages: ['en', 'zh'],
  isVerified: true,
  bio: 'Ten years guiding at Angkor.',
}

const transport = {
  id: 'veh-1',
  mode: 'tuk_tuk',
  operator: 'Mekong Express',
  priceUsd: 12,
  durationMinutes: 330,
}

function block(value: Record<string, unknown>): ContentBlock {
  return value as unknown as ContentBlock
}

function renderBlocks(blocks: Record<string, unknown>[], onAsk = vi.fn()) {
  renderWithProviders(<PayloadBlocks blocks={blocks.map(block)} onAsk={onAsk} />)
  return { onAsk }
}

describe('trip cards', () => {
  it('renders the trip with its price and duration', () => {
    renderBlocks([{ type: 'trip_cards', data: { trips: [trip] } }])

    expect(screen.getByText('Angkor Temple Discovery')).toBeInTheDocument()
    expect(screen.getByText('Three days among the temples.')).toBeInTheDocument()
    expect(screen.getByText(/3d/)).toBeInTheDocument()
    expect(screen.getByText(/\$189/)).toBeInTheDocument()
  })

  it('links to the real catalogue detail page', () => {
    renderBlocks([{ type: 'trip_cards', data: { trips: [trip] } }])

    // The agent's ids come from the same database, so this route resolves.
    expect(screen.getByRole('link', { name: /view details/i })).toHaveAttribute(
      'href',
      '/trips/trip-1',
    )
  })

  it('asks a follow-up naming the trip', async () => {
    const { onAsk } = renderBlocks([{ type: 'trip_cards', data: { trips: [trip] } }])

    await userEvent.click(screen.getByRole('button', { name: /find more like this/i }))
    expect(onAsk).toHaveBeenCalledWith('Tell me more about "Angkor Temple Discovery"')
  })

  it('renders a two-result comparison using the same cards', () => {
    renderBlocks([
      {
        type: 'comparison',
        data: { items: [trip, { ...trip, id: 'trip-2', name: 'Coastal Escape' }] },
      },
    ])

    // Headed as a comparison, because that is what the agent emitted.
    expect(screen.getByRole('heading', { name: /comparison/i })).toBeInTheDocument()
    expect(screen.getByText('Angkor Temple Discovery')).toBeInTheDocument()
    expect(screen.getByText('Coastal Escape')).toBeInTheDocument()
  })

  it('renders nothing for an empty trip list', () => {
    renderBlocks([{ type: 'trip_cards', data: { trips: [] } }])
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})

describe('hotel cards', () => {
  it('renders the hotel with a per-night price', () => {
    renderBlocks([{ type: 'hotel_cards', data: { hotels: [hotel] } }])

    expect(screen.getByText('Riverside Boutique')).toBeInTheDocument()
    expect(screen.getByText(/\$64/)).toBeInTheDocument()
    expect(screen.getByText(/per night/i)).toBeInTheDocument()
  })

  it('caps the amenity list so one hotel cannot dominate the reply', () => {
    renderBlocks([{ type: 'hotel_cards', data: { hotels: [hotel] } }])

    expect(screen.getByText('Wi-Fi · Pool · Breakfast')).toBeInTheDocument()
    expect(screen.queryByText(/Spa/)).not.toBeInTheDocument()
  })

  it('links to the hotel detail page', () => {
    renderBlocks([{ type: 'hotel_cards', data: { hotels: [hotel] } }])
    expect(screen.getByRole('link', { name: /view details/i })).toHaveAttribute(
      'href',
      '/hotels/hotel-1',
    )
  })
})

describe('guide cards', () => {
  it('renders the guide name the agent supplies', () => {
    // The REST catalogue has no guide name, but the agent normalises one.
    renderBlocks([{ type: 'guide_cards', data: { guides: [guide] } }])
    expect(screen.getByText('Sokha P.')).toBeInTheDocument()
  })

  it('marks a verified guide', () => {
    renderBlocks([{ type: 'guide_cards', data: { guides: [guide] } }])
    expect(screen.getByText('Verified')).toBeInTheDocument()
  })

  it('omits the verified badge when the guide is not verified', () => {
    renderBlocks([{ type: 'guide_cards', data: { guides: [{ ...guide, isVerified: false }] } }])
    expect(screen.queryByText('Verified')).not.toBeInTheDocument()
  })
})

describe('transport options', () => {
  it('renders the operator, humanised mode and duration', () => {
    renderBlocks([{ type: 'transport_options', data: { options: [transport] } }])

    expect(screen.getByText('Mekong Express')).toBeInTheDocument()
    // tuk_tuk -> "Tuk tuk", 330 minutes -> "5h 30m".
    expect(screen.getByText(/Tuk tuk/)).toBeInTheDocument()
    expect(screen.getByText(/5h 30m/)).toBeInTheDocument()
  })

  it('formats a whole-hour duration without stray minutes', () => {
    renderBlocks([
      { type: 'transport_options', data: { options: [{ ...transport, durationMinutes: 120 }] } },
    ])
    expect(screen.getByText(/2h(?! )/)).toBeInTheDocument()
  })

  it('formats a sub-hour duration in minutes', () => {
    renderBlocks([
      { type: 'transport_options', data: { options: [{ ...transport, durationMinutes: 45 }] } },
    ])
    expect(screen.getByText(/45m/)).toBeInTheDocument()
  })

  it('books through the conversation', async () => {
    const { onAsk } = renderBlocks([
      { type: 'transport_options', data: { options: [transport] } },
    ])

    await userEvent.click(screen.getByRole('button', { name: /book now/i }))
    expect(onAsk).toHaveBeenCalledWith('Book the Mekong Express option')
  })
})

describe('registry degradation', () => {
  it('skips a block that fails validation rather than throwing', () => {
    // Missing the required priceUsd.
    renderBlocks([{ type: 'trip_cards', data: { trips: [{ id: 't', name: 'Trip' }] } }])
    expect(screen.queryByText('Trip')).not.toBeInTheDocument()
  })

  it('skips a type the schema does not know at all', () => {
    renderBlocks([{ type: 'holodeck_tour', data: {} }])
    expect(screen.queryByTestId('unrendered-block')).not.toBeInTheDocument()
  })

  it('acknowledges a block type that has no renderer', () => {
    /*
     * Every schema type now renders, so this branch is unreachable through the
     * registry and is exercised directly instead. It is retained because a block
     * type added server-side would otherwise vanish silently.
     */
    renderWithProviders(<UnrenderedBlock type="future_block" />)

    const placeholder = screen.getByTestId('unrendered-block')
    expect(placeholder).toHaveAttribute('data-block-type', 'future_block')
    expect(placeholder).toHaveTextContent(/cannot be shown/i)
  })

  it('renders the good blocks even when one is malformed', () => {
    renderBlocks([
      { type: 'trip_cards', data: { trips: [{ id: 'bad' }] } },
      { type: 'hotel_cards', data: { hotels: [hotel] } },
    ])

    expect(screen.getByText('Riverside Boutique')).toBeInTheDocument()
  })

  it('renders multiple blocks together, as a multi-tool turn produces', () => {
    renderBlocks([
      { type: 'trip_cards', data: { trips: [trip] } },
      { type: 'hotel_cards', data: { hotels: [hotel] } },
      { type: 'guide_cards', data: { guides: [guide] } },
    ])

    const container = screen.getByTestId('payload-blocks')
    expect(within(container).getByText('Angkor Temple Discovery')).toBeInTheDocument()
    expect(within(container).getByText('Riverside Boutique')).toBeInTheDocument()
    expect(within(container).getByText('Sokha P.')).toBeInTheDocument()
  })

  it('renders nothing at all when there are no blocks', () => {
    const { container } = renderWithProviders(<PayloadBlocks blocks={[]} onAsk={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('reports which types have renderers', () => {
    expect(hasRenderer('trip_cards')).toBe(true)
    expect(hasRenderer('comparison')).toBe(true)
    expect(hasRenderer('hotel_cards')).toBe(true)
    expect(hasRenderer('guide_cards')).toBe(true)
    expect(hasRenderer('transport_options')).toBe(true)

    // Booking blocks landed too, so the registry is complete.
    expect(hasRenderer('qr_payment')).toBe(true)
    expect(hasRenderer('booking_summary')).toBe(true)
  })
})

describe('card accessibility', () => {
  it('gives every card list an accessible name', () => {
    renderBlocks([{ type: 'trip_cards', data: { trips: [trip] } }])
    expect(screen.getByRole('list', { name: /trips/i })).toBeInTheDocument()
  })

  it('gives card images real alt text, not a generic label', () => {
    renderBlocks([{ type: 'trip_cards', data: { trips: [trip] } }])
    expect(screen.getByAltText('Angkor Temple Discovery')).toBeInTheDocument()
  })

  it('omits the image element entirely when the agent sends no URL', () => {
    renderBlocks([{ type: 'trip_cards', data: { trips: [{ ...trip, imageUrl: undefined }] } }])
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
