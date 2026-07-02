/**
 * Task 18.2.8 — E2E (Playwright): Complete Vibe Booking flow.
 *
 * Drives the real `/vibe-booking` UI end to end:
 *   load → chat message → agent content (trip cards) → booking summary →
 *   trigger payment (requires_payment) → payment_completed → booking confirmed.
 *
 * The Python AI agent on `ws://localhost:8000/ws/chat` is NOT required: a mock
 * WebSocket is injected into the page before any app JS runs (`addInitScript`),
 * so the agent's server→client protocol is reproduced deterministically. The
 * mock speaks exactly the frames `hooks/useWebSocket.ts` understands and uses
 * the payload shapes defined by `schemas/vibe-booking.ts`:
 *
 *   client → server : auth, user_message, user_action, payment_completed, ping
 *   server → client : conversation_started, typing_start, agent_message,
 *                     typing_end, requires_payment, payment_status, pong
 *
 * Because the chat input is only enabled once the connection status flips to
 * "connected", a working (mock) socket is a hard prerequisite for the flow.
 */
import { test, expect, type Page } from '@playwright/test'

/**
 * Install a deterministic in-browser mock of `window.WebSocket`.
 *
 * It auto-opens, replies to `auth` with a `conversation_started` frame, answers
 * `ping` with `pong` (so the hook's liveness timer never force-closes us), and
 * scripts the booking flow in response to `user_message`, `user_action`
 * (`generate_payment_qr`) and `payment_completed` frames.
 */
async function installMockWebSocket(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Fixed identifiers keep assertions stable across runs.
    const BOOKING_ID = 'bk_e2e_0001'
    const BOOKING_REF = 'DERLG-E2E-7Q42'
    const TRIP_NAME = 'Angkor Sunrise Discovery'
    const PI_ID = 'pi_e2e_0001'
    const HOLD_EXPIRES_AT = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const TRAVEL_DATE = '2026-07-01'

    type Listener = (ev: { data: string }) => void

    class MockWebSocket {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3

      url: string
      readyState = MockWebSocket.CONNECTING
      onopen: (() => void) | null = null
      onmessage: Listener | null = null
      onclose: (() => void) | null = null
      onerror: (() => void) | null = null

      constructor(url: string) {
        this.url = url
        // Open on the next tick so the hook can attach handlers first.
        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN
          this.onopen?.()
        }, 0)
      }

      /** Push a server→client frame into the app. */
      private emit(obj: unknown) {
        // Defer slightly so the UI observes realistic async ordering.
        setTimeout(() => this.onmessage?.({ data: JSON.stringify(obj) }), 5)
      }

      send(raw: string) {
        let msg: { type?: string; action_type?: string }
        try {
          msg = JSON.parse(raw)
        } catch {
          return
        }

        switch (msg.type) {
          case 'auth':
            this.emit({
              type: 'conversation_started',
              session_id: 'sess_e2e_0001',
              text: 'Hi! I am your DerLg concierge. Where would you like to go in Cambodia?',
              suggested_prompts: ['Show me trips to Siem Reap', 'Find hotels near Angkor Wat'],
            })
            break

          case 'ping':
            this.emit({ type: 'pong' })
            break

          case 'user_message':
            // Agent "thinks", then returns a trip-cards block AND a booking
            // summary so the stage shows discovery + summary in one turn.
            this.emit({ type: 'typing_start' })
            this.emit({
              type: 'agent_message',
              session_id: 'sess_e2e_0001',
              text: 'Here is a great option for your trip — review the summary and pay when ready.',
              suggestions: ['Tell me more', 'Pay now'],
              content_payloads: [
                {
                  type: 'trip_cards',
                  data: {
                    trips: [
                      {
                        id: 'trip_001',
                        name: TRIP_NAME,
                        description: 'Sunrise over Angkor Wat plus the temples of Siem Reap.',
                        province: 'Siem Reap',
                        durationDays: 2,
                        priceUsd: 189,
                        rating: 4.8,
                        reviewCount: 312,
                      },
                    ],
                  },
                  metadata: { title: 'Recommended trips' },
                },
                {
                  type: 'booking_summary',
                  data: {
                    bookingId: BOOKING_ID,
                    itemType: 'trip',
                    itemName: TRIP_NAME,
                    travelDate: TRAVEL_DATE,
                    peopleCount: 2,
                    priceBreakdown: [{ label: '2 × Angkor Sunrise', amountUsd: 378 }],
                    totalUsd: 378,
                    cancellationPolicy: 'Free cancellation up to 7 days before travel.',
                    holdExpiresAt: HOLD_EXPIRES_AT,
                  },
                  metadata: { title: 'Booking summary' },
                },
              ],
            })
            this.emit({ type: 'typing_end' })
            break

          case 'user_action':
            // The booking-summary "Pay with Bakong" button fires
            // generate_payment_qr → the agent holds the booking and surfaces a
            // QR payment card via requires_payment.
            if (msg.action_type === 'generate_payment_qr') {
              this.emit({ type: 'typing_start' })
              this.emit({
                type: 'requires_payment',
                booking_id: BOOKING_ID,
                hold_expires_at: HOLD_EXPIRES_AT,
                content_payload: {
                  type: 'qr_payment',
                  data: {
                    qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?data=derlg-e2e',
                    amount: { usd: 378, khr: 1530000 },
                    expiry: HOLD_EXPIRES_AT,
                    paymentIntentId: PI_ID,
                    bookingId: BOOKING_ID,
                  },
                  actions: [
                    {
                      type: 'payment_completed',
                      label: 'I have paid',
                      payload: { booking_id: BOOKING_ID },
                      style: 'primary',
                    },
                  ],
                  metadata: { title: 'Scan to pay (Bakong)' },
                },
              })
              this.emit({ type: 'typing_end' })
            }
            break

          case 'payment_completed':
            // Backend confirmed the charge: flip booking → confirmed via
            // payment_status, and render the confirmation card via agent_message.
            this.emit({
              type: 'payment_status',
              payload: {
                paymentIntentId: PI_ID,
                booking_id: BOOKING_ID,
                booking_ref: BOOKING_REF,
                status: 'SUCCEEDED',
                amountUsd: 378,
              },
            })
            this.emit({
              type: 'agent_message',
              session_id: 'sess_e2e_0001',
              text: 'Your booking is confirmed. See you in Cambodia!',
              content_payloads: [
                {
                  type: 'booking_confirmed',
                  data: {
                    bookingRef: BOOKING_REF,
                    tripName: TRIP_NAME,
                    travelDate: TRAVEL_DATE,
                  },
                  metadata: { title: 'Booking confirmed' },
                },
              ],
            })
            // Clears the optimistic "streaming" state on the action's source card.
            this.emit({ type: 'typing_end' })
            break

          default:
            break
        }
      }

      close() {
        if (this.readyState === MockWebSocket.CLOSED) return
        this.readyState = MockWebSocket.CLOSED
        this.onclose?.()
      }

      // No-op EventTarget shims for API compatibility.
      addEventListener() {}
      removeEventListener() {}
    }

    // Replace the global before the app's WebSocket hook constructs a socket.
    // @ts-expect-error - overriding the DOM global with a test double.
    window.WebSocket = MockWebSocket
  })
}

/** Desktop viewport so the split-screen (not the mobile stacked) layout renders. */
test.use({ viewport: { width: 1280, height: 900 } })

test.describe('Vibe Booking — complete booking flow (mocked agent WS)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockWebSocket(page)
  })

  test('discover → chat → summary → payment → confirmation', async ({ page }) => {
    // The page renders TWO layouts simultaneously — a mobile stacked one
    // (`md:hidden`) and a desktop split-screen one (`hidden md:block`). At this
    // viewport only the desktop layout is visible, so every locator is scoped
    // to `visible=true` to avoid matching the hidden mobile duplicates.
    const visibleText = (text: string) => page.locator(`text=${text} >> visible=true`)
    const visibleButton = (name: string) =>
      page.getByRole('button', { name }).locator('visible=true')

    await page.goto('/vibe-booking')

    // 1. Connection establishes (chat input gates on this). Exact match so the
    // initial "Disconnected" badge (which contains "Connected") is not matched.
    await expect(page.getByText('Connected', { exact: true }).locator('visible=true')).toBeVisible()

    const input = page.getByTestId('multimodal-input').locator('visible=true')
    const sendButton = page.getByTestId('send-button').locator('visible=true')
    await expect(input).toBeEnabled()

    // 2. Send a chat message.
    await input.click()
    await input.fill('Plan a 2-day trip to Siem Reap for 2 people')
    await expect(sendButton).toBeEnabled()
    await sendButton.click()

    // The user's message echoes into the transcript.
    await expect(visibleText('Plan a 2-day trip to Siem Reap for 2 people')).toBeVisible()

    // 3. Agent content renders: trip card in the content stage.
    await expect(visibleText('Angkor Sunrise Discovery').first()).toBeVisible()

    // 4. Booking summary renders with its "Pay with Bakong" CTA.
    const payCta = visibleButton('Pay with Bakong')
    await expect(payCta).toBeVisible()
    await expect(visibleText('Booking summary')).toBeVisible()

    // 5. Trigger payment → requires_payment surfaces the QR payment card.
    await payCta.click()
    await expect(visibleText('Scan to pay (Bakong)')).toBeVisible()

    // The QR card exposes a "payment_completed" action button.
    const paidButton = visibleButton('I have paid')
    await expect(paidButton).toBeVisible()

    // 6. Simulate payment_completed → booking confirmed view asserted.
    await paidButton.click()

    await expect(visibleText('Booking Confirmed')).toBeVisible()
    // The confirmation card shows the booking reference returned by the agent.
    await expect(visibleText('DERLG-E2E-7Q42')).toBeVisible()
  })
})
