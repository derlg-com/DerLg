import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ComparisonTable } from '@/components/chat/payloads/comparison-table'
import { GalleryRail } from '@/components/chat/payloads/lightbox'
import { VibeStarter } from '@/components/chat/vibe-starter'
import { WorkspacePanel } from '@/components/chat/workspace-panel'
import type { WorkspaceState } from '@/lib/vibe/workspace'
import type { PayloadTrip } from '@/schemas/vibe-payloads'

import { renderWithProviders } from './helpers/render'

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
 * The workspace map pulls in Leaflet, which reads `window` at import time and is
 * loaded through next/dynamic in the app. Stubbed here so the panel can be tested
 * without a real map; the live map is covered by e2e/explore.spec.ts.
 */
vi.mock('@/components/map/leaflet-map', () => ({
  LeafletMap: ({ markers, ariaLabel }: { markers: { id: string }[]; ariaLabel: string }) => (
    <div data-testid="leaflet-map" data-marker-count={markers.length} aria-label={ariaLabel} />
  ),
}))

/*
 * Payment polling hits the BFF. Stubbed to "never resolves" so the tests assert
 * what the panel renders from the AGENT's blocks, not from a poll response — the
 * polling behaviour itself is covered separately by the hook's own contract.
 */
vi.mock('@/hooks/use-payment-status', () => ({
  usePaymentStatus: () => ({ data: undefined, isLoading: true }),
  toPaymentState: (raw: string) => raw?.toUpperCase() ?? 'PENDING',
}))

/**
 * The workspace UI pieces added for the Vibe Booking spec.
 *
 * These assert BEHAVIOUR a user can observe — which option is marked cheapest,
 * whether an expired hold can still be confirmed, whether a photo can be opened —
 * rather than markup, so they survive restyling.
 */

const TRIPS: PayloadTrip[] = [
  {
    id: 't1',
    name: 'Bokor Mountain Escape',
    priceUsd: 120,
    durationDays: 2,
    rating: 4.8,
    reviewCount: 64,
    province: 'Kampot',
    highlights: ['Sunset at the plateau', 'Old French hill station'],
  },
  {
    id: 't2',
    name: 'Kampot Relaxing Escape',
    priceUsd: 95,
    durationDays: 3,
    rating: 4.6,
    province: 'Kampot',
  },
]

describe('ComparisonTable', () => {
  it('renders one column per option and one row per attribute', () => {
    renderWithProviders(<ComparisonTable items={TRIPS} onAsk={vi.fn()} />)

    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: /Bokor Mountain Escape/ })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: /Kampot Relaxing Escape/ })).toBeInTheDocument()
    expect(within(table).getByRole('rowheader', { name: 'Price' })).toBeInTheDocument()
    expect(within(table).getByRole('rowheader', { name: 'Duration' })).toBeInTheDocument()
  })

  it('marks the cheapest and the top-rated option', () => {
    renderWithProviders(<ComparisonTable items={TRIPS} onAsk={vi.fn()} />)

    // "Which is cheaper?" is answered without the user doing arithmetic.
    const cheapest = screen.getByText('Cheapest').closest('th')
    expect(cheapest).toHaveTextContent('Kampot Relaxing Escape')

    const topRated = screen.getByText('Top rated').closest('th')
    expect(topRated).toHaveTextContent('Bokor Mountain Escape')
  })

  it('marks nothing when every option costs the same', () => {
    const flat: PayloadTrip[] = [
      { id: 'a', name: 'A', priceUsd: 100 },
      { id: 'b', name: 'B', priceUsd: 100 },
    ]
    renderWithProviders(<ComparisonTable items={flat} onAsk={vi.fn()} />)

    expect(screen.queryByText('Cheapest')).not.toBeInTheDocument()
  })

  it('omits a row no option has a value for', () => {
    const sparse: PayloadTrip[] = [
      { id: 'a', name: 'A', priceUsd: 100 },
      { id: 'b', name: 'B', priceUsd: 120 },
    ]
    renderWithProviders(<ComparisonTable items={sparse} onAsk={vi.fn()} />)

    // No ratings anywhere, so an all-dashes Rating row would be pure noise.
    expect(screen.queryByRole('rowheader', { name: 'Rating' })).not.toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Price' })).toBeInTheDocument()
  })

  it('renders nothing for a single item, since there is nothing to compare', () => {
    const { container } = renderWithProviders(
      <ComparisonTable items={[TRIPS[0]!]} onAsk={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('asks the concierge for a recommendation naming both options', async () => {
    const onAsk = vi.fn()
    renderWithProviders(<ComparisonTable items={TRIPS} onAsk={onAsk} />)

    await userEvent.click(screen.getByRole('button', { name: /which one do you recommend/i }))

    expect(onAsk).toHaveBeenCalledTimes(1)
    const message = onAsk.mock.calls[0]?.[0] as string
    expect(message).toContain('Bokor Mountain Escape')
    expect(message).toContain('Kampot Relaxing Escape')
  })
})

describe('GalleryRail', () => {
  const images = [
    { url: 'https://cdn.test/1.jpg', caption: 'Plateau' },
    { url: 'https://cdn.test/2.jpg' },
    { url: 'https://cdn.test/3.jpg' },
  ]

  it('opens the tapped photo in a labelled dialog', async () => {
    renderWithProviders(<GalleryRail images={images} title="Gallery" />)

    await userEvent.click(screen.getByRole('button', { name: 'Open photo 2 of 3' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAccessibleDescription('Photo 2 of 3')
  })

  it('pages with the arrow keys and wraps at the end', async () => {
    renderWithProviders(<GalleryRail images={images} title="Gallery" />)

    await userEvent.click(screen.getByRole('button', { name: 'Open photo 3 of 3' }))
    await screen.findByRole('dialog')

    // A photo viewer the keyboard cannot move through is mouse-only.
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Photo 1 of 3'),
    )

    await userEvent.keyboard('{ArrowLeft}')
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Photo 3 of 3'),
    )
  })

  it('renders nothing when there are no images', () => {
    const { container } = renderWithProviders(<GalleryRail images={[]} title="Gallery" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('VibeStarter', () => {
  it('sends a usable prompt before anything is chosen', async () => {
    const onSend = vi.fn()
    renderWithProviders(<VibeStarter onSend={onSend} />)

    await userEvent.click(screen.getByRole('button', { name: /ask the concierge/i }))

    expect(onSend).toHaveBeenCalledWith(
      "I'd like a trip somewhere in Cambodia — what do you recommend?",
    )
  })

  it('composes prose, not a query string, from the chosen chips', async () => {
    const onSend = vi.fn()
    renderWithProviders(<VibeStarter onSend={onSend} />)

    await userEvent.click(screen.getByRole('button', { name: 'Peaceful' }))
    await userEvent.click(screen.getByRole('button', { name: '3 days' }))
    await userEvent.click(screen.getByRole('button', { name: 'Couple' }))
    await userEvent.click(screen.getByRole('button', { name: 'Around $300' }))
    await userEvent.click(screen.getByRole('button', { name: /ask the concierge/i }))

    expect(onSend).toHaveBeenCalledWith(
      "I'd like a peaceful, relaxing trip in Cambodia for 3 days with my partner " +
        'and a budget of around $300 per person — what do you recommend?',
    )
  })

  it('lets a mis-tapped chip be cleared by tapping it again', async () => {
    renderWithProviders(<VibeStarter onSend={vi.fn()} />)

    const chip = screen.getByRole('button', { name: 'Beach' })
    await userEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('WorkspacePanel', () => {
  function panel(state: Partial<WorkspaceState>, props: Record<string, unknown> = {}) {
    return renderWithProviders(
      <WorkspacePanel
        state={{ hasContent: true, ...state } as WorkspaceState}
        onAsk={vi.fn()}
        {...props}
      />,
    )
  }

  it('explains itself when nothing has been selected yet', () => {
    panel({ hasContent: false })
    expect(screen.getByText(/nothing selected yet/i)).toBeInTheDocument()
  })

  it('pins the selected trip with its price and a book action', () => {
    panel({
      subject: {
        kind: 'trip',
        id: 't1',
        name: 'Bokor Mountain Escape',
        priceUsd: 120,
        priceUnit: 'perPerson',
        durationDays: 2,
      },
    })

    expect(screen.getByText('Selected trip')).toBeInTheDocument()
    expect(screen.getByText('Bokor Mountain Escape')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /book now/i })).toBeInTheDocument()
  })

  it('links a located subject out to Google Maps in a new tab', () => {
    panel({
      subject: {
        kind: 'hotel',
        id: 'h1',
        name: 'Riverside Boutique',
        priceUsd: 48,
        priceUnit: 'perNight',
        lat: 10.61,
        lng: 104.18,
      },
    })

    const link = screen.getByRole('link', { name: /google maps/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('google.com/maps'))
    expect(link).toHaveAttribute('target', '_blank')
    // Without noreferrer the target page can reach back through window.opener.
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('refuses to offer payment on an expired hold', () => {
    panel({
      hold: {
        bookingId: 'b1',
        itemName: 'Bokor Mountain Escape',
        travelDate: '2026-02-01',
        peopleCount: 2,
        totalUsd: 240,
        holdExpiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
    })

    // A button that is guaranteed to fail server-side must not look pressable.
    expect(screen.getByRole('button', { name: /hold expired/i })).toBeDisabled()
  })

  it('shows a live countdown on an unexpired hold', () => {
    panel({
      hold: {
        bookingId: 'b1',
        itemName: 'Bokor Mountain Escape',
        travelDate: '2026-02-01',
        peopleCount: 2,
        totalUsd: 240,
        holdExpiresAt: new Date(Date.now() + 9 * 60_000).toISOString(),
      },
    })

    // Exact seconds race with the tick; that it is counting down is the contract.
    expect(screen.getByText(/expires in \d+m/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pay now/i })).toBeEnabled()
  })

  it('offers sign-in rather than a payment claim button for a guest', () => {
    panel({
      payment: {
        bookingId: 'b1',
        paymentIntentId: 'pi_1',
        amountUsd: 240,
        qrUrl: 'https://cdn.test/qr.png',
        expiry: new Date(Date.now() + 10 * 60_000).toISOString(),
      },
    })

    // The agent rejects unauthenticated payment claims, so do not offer one.
    expect(screen.queryByRole('button', { name: /i've paid/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in to confirm payment/i })).toBeInTheDocument()
  })

  it('hides the QR code once the payment has succeeded', () => {
    panel({
      payment: {
        bookingId: 'b1',
        paymentIntentId: 'pi_1',
        amountUsd: 240,
        qrUrl: 'https://cdn.test/qr.png',
        status: 'SUCCEEDED',
      },
    })

    expect(screen.queryByAltText(/scan qr/i)).not.toBeInTheDocument()
    expect(screen.getByText(/payment successful/i)).toBeInTheDocument()
  })

  it('locks the payment claim after one press, then lets it be retried', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const onPaymentCompleted = vi.fn()
      panel(
        {
          payment: {
            bookingId: 'b1',
            paymentIntentId: 'pi_1',
            amountUsd: 240,
            qrUrl: 'https://cdn.test/qr.png',
            expiry: new Date(Date.now() + 10 * 60_000).toISOString(),
          },
        },
        { isAuthenticated: true, onPaymentCompleted },
      )

      const claim = screen.getByRole('button', { name: /i've paid/i })
      await userEvent.click(claim)

      // One press, one agent turn — a second click would cost another.
      expect(onPaymentCompleted).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: /checking for your payment/i })).toBeDisabled()

      // But it must come back: the agent may answer "not confirmed yet", which
      // changes no status, and a permanently dead button is a dead end.
      await act(async () => {
        vi.advanceTimersByTime(8100)
      })
      expect(screen.getByRole('button', { name: /i've paid/i })).toBeEnabled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows a confirmed booking with its reference', () => {
    panel({
      confirmation: {
        bookingRef: 'DLG-2026-12345',
        tripName: 'Bokor Mountain Escape',
        travelDate: '2026-02-01',
      },
    })

    expect(screen.getByText('DLG-2026-12345')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view booking/i })).toBeInTheDocument()
  })

  it('nudges towards comparing when options exist but nothing is selected', async () => {
    const onAsk = vi.fn()
    renderWithProviders(
      <WorkspacePanel
        state={{ hasContent: true, options: { kind: 'trip', count: 3 } }}
        onAsk={onAsk}
      />,
    )

    expect(screen.getByText('3 trips to choose from')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /compare them/i }))
    expect(onAsk).toHaveBeenCalledWith('Compare these options for me')
  })
})
