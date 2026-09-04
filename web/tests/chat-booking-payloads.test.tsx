import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PayloadBlocks, hasRenderer } from '@/components/chat/payloads/block-renderer'
import { CONTENT_PAYLOAD_TYPES } from '@/schemas/vibe-payloads'
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

/** Fixed "now" so expiry maths is deterministic. */
const NOW = new Date('2026-08-01T10:00:00.000Z')
const IN_TEN_MINUTES = '2026-08-01T10:10:00.000Z'
const TEN_MINUTES_AGO = '2026-08-01T09:50:00.000Z'

function renderBlocks(
  blocks: Record<string, unknown>[],
  context: {
    onAsk?: (text: string) => void
    onPaymentCompleted?: (bookingId: string) => void
    isAuthenticated?: boolean
  } = {},
) {
  const onAsk = vi.fn(context.onAsk ?? (() => {}))
  const onPaymentCompleted = vi.fn(context.onPaymentCompleted ?? (() => {}))

  renderWithProviders(
    <PayloadBlocks
      blocks={blocks as unknown as ContentBlock[]}
      onAsk={onAsk}
      onPaymentCompleted={onPaymentCompleted}
      isAuthenticated={context.isAuthenticated ?? false}
    />,
  )
  return { onAsk, onPaymentCompleted }
}

const summary = {
  bookingId: 'bk_1',
  itemType: 'trip' as const,
  itemName: 'Angkor Temple Discovery',
  travelDate: '2026-09-12',
  peopleCount: 2,
  priceBreakdown: [
    { label: 'Trip × 2', amountUsd: 378 },
    { label: 'Guide', amountUsd: 45 },
  ],
  totalUsd: 423,
  cancellationPolicy: 'Free cancellation up to 7 days before departure.',
  holdExpiresAt: IN_TEN_MINUTES,
}

const qr = {
  qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?data=pay',
  amount: { usd: 423 },
  expiry: IN_TEN_MINUTES,
  paymentIntentId: 'pi_abc123',
  bookingId: 'bk_1',
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('booking summary block', () => {
  it('renders the item, breakdown and total', () => {
    renderBlocks([{ type: 'booking_summary', data: summary }])

    expect(screen.getByText('Angkor Temple Discovery')).toBeInTheDocument()
    expect(screen.getByText('Trip × 2')).toBeInTheDocument()
    expect(screen.getByText(/\$423/)).toBeInTheDocument()
  })

  it('shows the traveller count and cancellation policy', () => {
    renderBlocks([{ type: 'booking_summary', data: summary }])

    expect(screen.getByText(/2 travellers/i)).toBeInTheDocument()
    expect(screen.getByText(/free cancellation/i)).toBeInTheDocument()
  })

  it('counts down the hold while it is still valid', () => {
    renderBlocks([{ type: 'booking_summary', data: summary }])

    // Ten minutes out from the fixed clock.
    expect(screen.getByText(/10m 0s/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm booking/i })).toBeEnabled()
  })

  it('updates the countdown as time passes', () => {
    renderBlocks([{ type: 'booking_summary', data: summary }])

    act(() => {
      vi.advanceTimersByTime(65_000)
    })

    expect(screen.getByText(/8m 55s/)).toBeInTheDocument()
  })

  it('disables confirmation once the hold has expired', () => {
    renderBlocks([
      { type: 'booking_summary', data: { ...summary, holdExpiresAt: TEN_MINUTES_AGO } },
    ])

    // A confirm button that the server will reject is worse than a disabled one.
    expect(screen.getByRole('button', { name: /confirm booking/i })).toBeDisabled()
    expect(screen.getByText(/hold expired/i)).toBeInTheDocument()
  })

  it('expires live, not just on first render', () => {
    renderBlocks([
      {
        type: 'booking_summary',
        data: { ...summary, holdExpiresAt: '2026-08-01T10:00:30.000Z' },
      },
    ])

    expect(screen.getByRole('button', { name: /confirm booking/i })).toBeEnabled()

    act(() => {
      vi.advanceTimersByTime(31_000)
    })

    expect(screen.getByRole('button', { name: /confirm booking/i })).toBeDisabled()
  })

  it('renders without a hold at all', () => {
    const { holdExpiresAt: _omitted, ...noHold } = summary
    renderBlocks([{ type: 'booking_summary', data: noHold }])

    // No deadline means "does not expire", not "already expired".
    expect(screen.getByRole('button', { name: /confirm booking/i })).toBeEnabled()
    expect(screen.queryByText(/hold expired/i)).not.toBeInTheDocument()
  })

  it('confirms through the conversation', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onAsk } = renderBlocks([{ type: 'booking_summary', data: summary }])

    await user.click(screen.getByRole('button', { name: /confirm booking/i }))
    expect(onAsk).toHaveBeenCalledWith('Confirm my booking for Angkor Temple Discovery')
  })

  it('links to the booking record', () => {
    renderBlocks([{ type: 'booking_summary', data: summary }])
    expect(screen.getByRole('link', { name: /view booking/i })).toHaveAttribute(
      'href',
      '/bookings/bk_1',
    )
  })
})

describe('qr payment block', () => {
  it('renders the code and the amount', () => {
    renderBlocks([{ type: 'qr_payment', data: qr }], { isAuthenticated: true })

    expect(screen.getByAltText(/scan qr/i)).toHaveAttribute('src', qr.qrUrl)
    expect(screen.getByText(/\$423/)).toBeInTheDocument()
  })

  it('offers payment confirmation to a signed-in user', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onPaymentCompleted } = renderBlocks([{ type: 'qr_payment', data: qr }], {
      isAuthenticated: true,
    })

    await user.click(screen.getByRole('button', { name: /i've paid/i }))
    expect(onPaymentCompleted).toHaveBeenCalledWith('bk_1')
  })

  it('asks a guest to sign in instead of offering a button that would fail', () => {
    // The agent answers "Cannot verify payment." for unauthenticated sessions.
    renderBlocks([{ type: 'qr_payment', data: qr }], { isAuthenticated: false })

    expect(screen.queryByRole('button', { name: /i've paid/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in to confirm payment/i })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('explains itself when the payload carries no booking reference', () => {
    const { bookingId: _omitted, ...noRef } = qr
    renderBlocks([{ type: 'qr_payment', data: noRef }], { isAuthenticated: true })

    expect(screen.queryByRole('button', { name: /i've paid/i })).not.toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/no booking reference/i)
  })

  it('withdraws payment confirmation once the code expires', () => {
    renderBlocks([{ type: 'qr_payment', data: { ...qr, expiry: TEN_MINUTES_AGO } }], {
      isAuthenticated: true,
    })

    expect(screen.queryByRole('button', { name: /i've paid/i })).not.toBeInTheDocument()
    expect(screen.getByText(/payment code has expired/i)).toBeInTheDocument()
  })

  it('honours an explicit expired flag pushed by the agent', () => {
    // The agent can push `expired` on a hold-expiry update independently of the date.
    renderBlocks([{ type: 'qr_payment', data: { ...qr, expired: true } }], {
      isAuthenticated: true,
    })

    expect(screen.queryByRole('button', { name: /i've paid/i })).not.toBeInTheDocument()
  })
})

describe('stripe card form block', () => {
  const card = { bookingId: 'bk_1', amount: { usd: 423 } }

  it('renders NO card input fields at all', () => {
    renderBlocks([{ type: 'stripe_card_form', data: card }], { isAuthenticated: true })

    /*
     * There is no PaymentIntent endpoint, so a card field would go nowhere. Inviting
     * someone to type a real card number into a dead form is worse than no form.
     */
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/card number/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/cvc/i)).not.toBeInTheDocument()
  })

  it('states plainly that nothing is charged', () => {
    renderBlocks([{ type: 'stripe_card_form', data: card }], { isAuthenticated: true })

    expect(screen.getByText(/demo mode/i)).toBeInTheDocument()
    expect(screen.getByText(/nothing is charged/i)).toBeInTheDocument()
    expect(screen.getByText(/sandbox payment/i)).toBeInTheDocument()
  })

  it('confirms the sandbox payment for a signed-in user', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onPaymentCompleted } = renderBlocks([{ type: 'stripe_card_form', data: card }], {
      isAuthenticated: true,
    })

    await user.click(screen.getByRole('button', { name: /complete payment/i }))
    expect(onPaymentCompleted).toHaveBeenCalledWith('bk_1')
  })

  it('asks a guest to sign in first', () => {
    renderBlocks([{ type: 'stripe_card_form', data: card }], { isAuthenticated: false })

    expect(screen.queryByRole('button', { name: /complete payment/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in to confirm payment/i })).toBeInTheDocument()
  })
})

describe('payment status block', () => {
  const base = { paymentIntentId: 'pi_abc123', bookingId: 'bk_1', amountUsd: 423 }

  it('labels every status the backend can report', () => {
    for (const [status, label] of [
      ['PENDING', /pending/i],
      ['SUCCEEDED', /succeeded/i],
      ['FAILED', /failed/i],
      ['CANCELLED', /cancelled/i],
    ] as const) {
      const { unmount } = renderWithProviders(
        <PayloadBlocks
          blocks={
            [{ type: 'payment_status', data: { ...base, status } }] as unknown as ContentBlock[]
          }
          onAsk={vi.fn()}
        />,
      )
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })

  it('offers a retry only when the payment failed', () => {
    renderBlocks([{ type: 'payment_status', data: { ...base, status: 'FAILED' } }])
    expect(screen.getByRole('button', { name: /retry payment/i })).toBeInTheDocument()
  })

  it('does not offer a retry on a successful payment', () => {
    renderBlocks([{ type: 'payment_status', data: { ...base, status: 'SUCCEEDED' } }])
    expect(screen.queryByRole('button', { name: /retry payment/i })).not.toBeInTheDocument()
  })

  it('retries through the conversation', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onAsk } = renderBlocks([
      { type: 'payment_status', data: { ...base, status: 'FAILED' } },
    ])

    await user.click(screen.getByRole('button', { name: /retry payment/i }))
    expect(onAsk).toHaveBeenCalledWith('Retry my payment')
  })

  it('shows the payment reference and links a receipt when one exists', () => {
    renderBlocks([
      {
        type: 'payment_status',
        data: { ...base, status: 'SUCCEEDED', receiptUrl: 'https://pay.example/r/1' },
      },
    ])

    expect(screen.getByText(/pi_abc123/)).toBeInTheDocument()

    const receipt = screen.getByRole('link', { name: /view receipt/i })
    expect(receipt).toHaveAttribute('href', 'https://pay.example/r/1')
    // An external link opened in a new tab must not leak the referrer or opener.
    expect(receipt).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('omits the receipt link when there is no receipt', () => {
    renderBlocks([{ type: 'payment_status', data: { ...base, status: 'PENDING' } }])
    expect(screen.queryByRole('link', { name: /view receipt/i })).not.toBeInTheDocument()
  })
})

describe('booking confirmed block', () => {
  const confirmed = {
    bookingRef: 'DERLG-4821',
    tripName: 'Angkor Temple Discovery',
    travelDate: '2026-09-12',
  }

  it('announces the confirmation and shows the reference', () => {
    renderBlocks([{ type: 'booking_confirmed', data: confirmed }])

    // Worth announcing, not just showing.
    expect(screen.getByRole('status')).toHaveTextContent(/booking confirmed/i)
    expect(screen.getByText('DERLG-4821')).toBeInTheDocument()
  })

  it('renders a ticket QR when the agent supplies one', () => {
    renderBlocks([
      { type: 'booking_confirmed', data: { ...confirmed, qrCode: 'https://x/ticket.png' } },
    ])

    expect(screen.getByAltText(/DERLG-4821/)).toHaveAttribute('src', 'https://x/ticket.png')
  })

  it('renders without a QR code', () => {
    renderBlocks([{ type: 'booking_confirmed', data: confirmed }])
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('links to the booking record', () => {
    renderBlocks([{ type: 'booking_confirmed', data: confirmed }])
    expect(screen.getByRole('link', { name: /view booking/i })).toHaveAttribute(
      'href',
      '/bookings/DERLG-4821',
    )
  })
})

describe('registry completeness', () => {
  it('now has a renderer for every declared block type', () => {
    const missing = CONTENT_PAYLOAD_TYPES.filter((type) => !hasRenderer(type))
    expect(missing).toEqual([])
  })

  it('renders a booking turn combining a summary and a QR code', () => {
    renderBlocks(
      [
        { type: 'booking_summary', data: summary },
        { type: 'qr_payment', data: qr },
      ],
      { isAuthenticated: true },
    )

    const container = screen.getByTestId('payload-blocks')
    expect(within(container).getByText('Angkor Temple Discovery')).toBeInTheDocument()
    expect(within(container).getByAltText(/scan qr/i)).toBeInTheDocument()
  })
})
