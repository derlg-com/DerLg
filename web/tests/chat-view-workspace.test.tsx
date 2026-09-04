import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { InboundFrame } from '@/lib/vibe/protocol'

import { renderWithProviders } from './helpers/render'

/**
 * ChatView as a whole: the workspace layout, the first-turn starter, and the
 * scroll behaviour.
 *
 * The socket is mocked rather than faked at the WebSocket level, because what is
 * under test is how the view REACTS to frames — a real socket would only add
 * timing flakiness to assertions about rendering.
 */

/** Captured so a test can push agent frames into the view. */
let pushFrame: (frame: InboundFrame) => void = () => {}
const sent: unknown[] = []

vi.mock('@/hooks/use-vibe-socket', () => ({
  useVibeSocket: ({ onFrame }: { onFrame: (frame: InboundFrame) => void }) => {
    pushFrame = onFrame
    return {
      status: 'connected',
      rejectedCode: null,
      send: (frame: unknown) => sent.push(frame),
      reconnect: vi.fn(),
      startNewConversation: vi.fn(),
      queueLength: 0,
    }
  },
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/hooks/use-auth', () => ({
  useSession: () => ({ user: null, ready: true }),
  useAccessToken: () => null,
}))

vi.mock('@/hooks/use-online-status', () => ({ useOnlineStatus: () => true }))

vi.mock('@/lib/i18n/navigation', () => ({
  usePathname: () => '/chat',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/map/leaflet-map', () => ({
  LeafletMap: ({ markers }: { markers: { id: string }[] }) => {
    // Counted so "does the map rebuild on every token?" is assertable.
    ;(globalThis as { __mapMarkerIdentities?: unknown[] }).__mapMarkerIdentities?.push(markers)
    return <div data-testid="leaflet-map" data-marker-count={markers.length} />
  },
}))

vi.mock('@/hooks/use-payment-status', () => ({
  usePaymentStatus: () => ({ data: undefined, isLoading: false }),
  toPaymentState: (raw: string) => raw?.toUpperCase() ?? 'PENDING',
}))

// Imported after the mocks so the module graph picks them up.
const { ChatView } = await import('@/components/chat/chat-view')

const TRIP_DETAIL_FRAME: InboundFrame = {
  type: 'agent_message',
  text: 'Here are the full details.',
  message_id: 'm1',
  content_payloads: [
    {
      type: 'trip_detail',
      data: {
        id: 't1',
        name: 'Bokor Mountain Escape',
        priceUsd: 120,
        durationDays: 2,
        lat: 10.6,
        lng: 104.05,
      },
    },
  ],
} as InboundFrame

beforeEach(() => {
  sent.length = 0
})

describe('ChatView workspace layout', () => {
  it('offers the vibe starter before the user has said anything', () => {
    renderWithProviders(<ChatView />)

    expect(screen.getByTestId('vibe-starter')).toBeInTheDocument()
    // The workspace is present but honest about being empty.
    expect(screen.getAllByText(/nothing selected yet/i).length).toBeGreaterThan(0)
  })

  it('retires the starter once the conversation has begun', async () => {
    renderWithProviders(<ChatView />)

    await userEvent.type(screen.getByLabelText(/message the concierge/i), 'Somewhere peaceful')
    await userEvent.click(screen.getByRole('button', { name: /^send$/i }))

    expect(screen.queryByTestId('vibe-starter')).not.toBeInTheDocument()
    expect(sent).toContainEqual({ type: 'user_message', content: 'Somewhere peaceful' })
  })

  it('sends the starter-composed prompt as a plain user message', async () => {
    renderWithProviders(<ChatView />)

    await userEvent.click(screen.getByRole('button', { name: 'Temples' }))
    await userEvent.click(screen.getByRole('button', { name: /ask the concierge/i }))

    const message = sent.find(
      (frame): frame is { type: string; content: string } =>
        typeof frame === 'object' && frame !== null && 'content' in frame,
    )
    expect(message?.type).toBe('user_message')
    expect(message?.content).toContain('temples and history')
  })

  it('pins the selected trip into the workspace rail, not just the transcript', () => {
    renderWithProviders(<ChatView />)

    act(() => pushFrame(TRIP_DETAIL_FRAME))

    const rail = screen.getByRole('complementary', { name: /trip workspace/i })
    expect(within(rail).getByText('Selected trip')).toBeInTheDocument()
    expect(within(rail).getByText('Bokor Mountain Escape')).toBeInTheDocument()
    // A located subject gets a Google Maps handoff (spec §7).
    expect(within(rail).getByRole('link', { name: /google maps/i })).toHaveAttribute(
      'href',
      expect.stringContaining('google.com/maps'),
    )
  })

  it('exposes the workspace behind a single control on small screens', () => {
    renderWithProviders(<ChatView />)

    // Nothing to show yet, so no pill — an empty sheet is not worth a tap target.
    expect(screen.queryByRole('button', { name: /open trip workspace/i })).not.toBeInTheDocument()

    act(() => pushFrame(TRIP_DETAIL_FRAME))

    expect(screen.getByRole('button', { name: /open trip workspace/i })).toBeInTheDocument()
  })

  it('opens the workspace sheet as a modal dialog', async () => {
    renderWithProviders(<ChatView />)
    act(() => pushFrame(TRIP_DETAIL_FRAME))

    await userEvent.click(screen.getByRole('button', { name: /open trip workspace/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Bokor Mountain Escape')).toBeInTheDocument()
  })

  it('renders the reply in the transcript as well as the rail', () => {
    renderWithProviders(<ChatView />)
    act(() => pushFrame(TRIP_DETAIL_FRAME))

    const transcript = screen.getByRole('list', { name: /conversation/i })
    expect(within(transcript).getByText('Here are the full details.')).toBeInTheDocument()
    // The transcript is the record; the rail is current state. Both, deliberately.
    expect(within(transcript).getByTestId('payload-blocks')).toBeInTheDocument()
  })
})

describe('ChatView does not thrash the workspace while streaming', () => {
  const MAP_FRAME: InboundFrame = {
    type: 'agent_message',
    text: 'Here it is.',
    message_id: 'm1',
    content_payloads: [
      {
        type: 'map_view',
        data: {
          center: { lat: 10.6, lng: 104.05 },
          markers: [{ id: 'm1', lat: 10.6, lng: 104.05, label: 'Bokor' }],
        },
      },
    ],
  } as InboundFrame

  it('hands the map the same marker array across a whole streamed reply', async () => {
    const identities: unknown[] = []
    ;(globalThis as { __mapMarkerIdentities?: unknown[] }).__mapMarkerIdentities = identities

    renderWithProviders(<ChatView />)
    act(() => pushFrame(MAP_FRAME))

    // LeafletMap arrives through next/dynamic, so it mounts a tick later.
    await waitFor(() => expect(screen.getAllByTestId('leaflet-map').length).toBeGreaterThan(0))
    expect(identities.length).toBeGreaterThan(0)
    const baseline = new Set(identities).size

    /*
     * Stream twenty chunks, as a real reply does. LeafletMap's marker effect keys
     * on the array IDENTITY and, when it changes, clears every layer, rebuilds it
     * and re-runs fitBounds. A new array per chunk would tear the map down twenty
     * times mid-reply.
     */
    act(() => {
      pushFrame({ type: 'typing_start' } as InboundFrame)
      for (let i = 0; i < 20; i += 1) {
        pushFrame({ type: 'agent_stream_chunk', content: `chunk ${i} ` } as InboundFrame)
      }
    })
    await waitFor(() => expect(screen.getByText(/chunk 19/)).toBeInTheDocument())

    // Still one identity per mounted map, no matter how many chunks arrived.
    expect(new Set(identities).size).toBe(baseline)

    delete (globalThis as { __mapMarkerIdentities?: unknown[] }).__mapMarkerIdentities
  })
})

describe('ChatView transcript scrolling', () => {
  /** jsdom reports zero-size elements, so the geometry has to be supplied. */
  function setScrollGeometry(el: HTMLElement, { scrollTop }: { scrollTop: number }) {
    Object.defineProperty(el, 'scrollHeight', { value: 2000, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true })
    Object.defineProperty(el, 'scrollTop', { value: scrollTop, configurable: true, writable: true })
  }

  it('offers a jump-to-latest control once the user scrolls back through history', () => {
    const { container } = renderWithProviders(<ChatView />)
    act(() => pushFrame(TRIP_DETAIL_FRAME))

    expect(screen.queryByRole('button', { name: /jump to latest/i })).not.toBeInTheDocument()

    const scroller = container.querySelector('.overflow-y-auto') as HTMLElement
    expect(scroller).not.toBeNull()

    // Scrolled well away from the bottom: the user is reading, not following.
    setScrollGeometry(scroller, { scrollTop: 200 })
    act(() => scroller.dispatchEvent(new Event('scroll', { bubbles: true })))

    expect(screen.getByRole('button', { name: /jump to latest/i })).toBeInTheDocument()
  })

  it('withdraws the control when the user returns to the bottom', () => {
    const { container } = renderWithProviders(<ChatView />)
    act(() => pushFrame(TRIP_DETAIL_FRAME))

    const scroller = container.querySelector('.overflow-y-auto') as HTMLElement

    setScrollGeometry(scroller, { scrollTop: 200 })
    act(() => scroller.dispatchEvent(new Event('scroll', { bubbles: true })))
    expect(screen.getByRole('button', { name: /jump to latest/i })).toBeInTheDocument()

    // 2000 - 1500 - 500 = 0px from the bottom: following again.
    setScrollGeometry(scroller, { scrollTop: 1500 })
    act(() => scroller.dispatchEvent(new Event('scroll', { bubbles: true })))
    expect(screen.queryByRole('button', { name: /jump to latest/i })).not.toBeInTheDocument()
  })
})
