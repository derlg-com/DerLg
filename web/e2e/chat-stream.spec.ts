import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Chat shell against a SCRIPTED agent.
 *
 * The live agent depends on an upstream LLM, so its replies are neither
 * deterministic nor guaranteed to arrive. These tests stand in as the agent and
 * emit the exact frame sequence from its websocket.py, which is what makes the
 * streaming pipeline — chunks, reasoning, tool chips, then the committed message
 * with payload blocks and suggestions — assertable end to end in the browser.
 */

const SESSION = '11111111-1111-4111-8111-111111111111'

type Frame = Record<string, unknown>

/**
 * Serves the chat WebSocket from inside the browser context.
 *
 * `script` returns the frames to emit in response to a user_message, each with a
 * delay, so streaming can be observed rather than appearing all at once.
 */
async function mockAgent(page: Page, replyFrames: { frame: Frame; delayMs?: number }[]) {
  await page.routeWebSocket(/ws\/chat/, (ws) => {
    ws.onMessage((raw) => {
      const message = JSON.parse(String(raw)) as { type: string }

      if (message.type === 'auth') {
        ws.send(
          JSON.stringify({
            type: 'conversation_started',
            text: 'Welcome to DerLg!',
            session_id: SESSION,
            suggested_prompts: ['Plan a 3-day Siem Reap temple tour'],
          }),
        )
        return
      }

      if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }))
        return
      }

      if (message.type === 'user_message') {
        let elapsed = 0
        for (const step of replyFrames) {
          elapsed += step.delayMs ?? 60
          setTimeout(() => ws.send(JSON.stringify(step.frame)), elapsed)
        }
      }
    })
  })
}

/** The frame order the real agent produces for a tool-using turn. */
const FULL_TURN = [
  { frame: { type: 'typing_start' } },
  { frame: { type: 'agent_tool_status', tool: 'search_trips', status: 'running' } },
  { frame: { type: 'agent_reasoning_chunk', content: 'The traveller wants temples near Siem Reap. ' } },
  { frame: { type: 'agent_stream_chunk', content: 'I found ' } },
  { frame: { type: 'agent_stream_chunk', content: 'three temple trips ' } },
  { frame: { type: 'agent_stream_chunk', content: 'for you.' } },
  { frame: { type: 'agent_tool_status', tool: 'search_trips', status: 'completed' } },
  { frame: { type: 'typing_end' } },
  {
    frame: {
      type: 'agent_message',
      text: 'I found three temple trips for you.',
      content_payloads: [
        {
          type: 'trip_cards',
          data: {
            trips: [
              {
                id: 'trip-1',
                name: 'Angkor Temple Discovery',
                blurb: 'Three days among the temples.',
                province: 'Siem Reap',
                durationDays: 3,
                priceUsd: 189,
              },
            ],
          },
          actions: [],
          metadata: {},
        },
      ],
      suggestions: ['Show hotels nearby', 'Add a guide'],
    },
  },
]

async function openChatAndAsk(page: Page, text = 'Find me a temple tour') {
  await page.goto('/en/chat')
  await expect(page.getByText('Welcome to DerLg!')).toBeVisible({ timeout: 15_000 })

  const composer = page.getByLabel(/message the concierge/i)
  await composer.fill(text)
  await composer.press('Enter')
}

test.describe('chat streaming pipeline', () => {
  test('renders the greeting and prompts from the handshake', async ({ page }) => {
    await mockAgent(page, FULL_TURN)
    await page.goto('/en/chat')

    await expect(page.getByText('Welcome to DerLg!')).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByRole('button', { name: 'Plan a 3-day Siem Reap temple tour' }),
    ).toBeVisible()
  })

  test('shows tool activity by name while the agent works', async ({ page }) => {
    await mockAgent(page, FULL_TURN)
    await openChatAndAsk(page)

    // The tools catalogue turns search_trips into human copy.
    await expect(page.getByText('Searching trips…')).toBeVisible({ timeout: 10_000 })
  })

  test('streams the reply text progressively', async ({ page }) => {
    await mockAgent(
      page,
      // Slow the chunks so a partial state is observable.
      FULL_TURN.map((step) => ({ ...step, delayMs: 400 })),
    )
    await openChatAndAsk(page)

    const streaming = page.getByLabel(/concierge is replying/i)
    await expect(streaming).toContainText('I found', { timeout: 10_000 })
    // Then it completes.
    await expect(page.getByText('I found three temple trips for you.')).toBeVisible({
      timeout: 20_000,
    })
  })

  test('exposes the reasoning collapsed, not covering the answer', async ({ page }) => {
    await mockAgent(page, FULL_TURN)
    await openChatAndAsk(page)

    /*
     * Wait for the turn to COMMIT first. Reasoning is rendered by the streaming
     * bubble and then re-parented onto the committed message, so grabbing the
     * element mid-stream races that swap and detaches the locator.
     */
    await expect(page.getByText('I found three temple trips for you.')).toBeVisible({
      timeout: 20_000,
    })
    /*
     * And wait for the streaming bubble to go: that is the observable signal that
     * the re-parenting is finished and no further render is pending, so the click
     * below cannot be swallowed by a reconciliation mid-press.
     */
    await expect(page.getByLabel(/concierge is replying/i)).toBeHidden()

    const details = page.locator('details').first()
    await expect(details).toBeVisible()

    // Collapsed by default; the reasoning text is not shown until asked for.
    await expect(details).not.toHaveAttribute('open', '')

    await details.locator('summary').click()
    await expect(page.getByText(/traveller wants temples/i)).toBeVisible()
  })

  test('commits the final message and clears the streaming placeholder', async ({ page }) => {
    await mockAgent(page, FULL_TURN)
    await openChatAndAsk(page)

    await expect(page.getByText('I found three temple trips for you.')).toBeVisible({
      timeout: 15_000,
    })

    // The in-flight bubble and the tool chips are gone once the turn commits.
    await expect(page.getByLabel(/concierge is replying/i)).toBeHidden()
    await expect(page.getByText('Searching trips…')).toBeHidden()
  })

  test('renders the attached trip card with a working catalogue link', async ({ page }) => {
    await mockAgent(page, FULL_TURN)
    await openChatAndAsk(page)

    const blocks = page.getByTestId('payload-blocks')
    await expect(blocks).toBeVisible({ timeout: 15_000 })

    await expect(blocks.getByText('Angkor Temple Discovery')).toBeVisible()
    await expect(blocks.getByText(/\$189/)).toBeVisible()

    // The agent's ids come from the same database, so the link must be real and
    // locale-prefixed.
    await expect(blocks.getByRole('link', { name: /view details/i })).toHaveAttribute(
      'href',
      '/en/trips/trip-1',
    )
  })

  test('a card follow-up becomes the next user message', async ({ page }) => {
    await mockAgent(page, FULL_TURN)
    await openChatAndAsk(page)

    const blocks = page.getByTestId('payload-blocks')
    await expect(blocks).toBeVisible({ timeout: 15_000 })

    await blocks.getByRole('button', { name: /find more like this/i }).click()
    await expect(
      page.getByText('Tell me more about "Angkor Temple Discovery"', { exact: true }),
    ).toBeVisible()
  })

  test('renders a booking hold with a live countdown and a confirm action', async ({ page }) => {
    // Far enough out that the countdown is unambiguously running.
    const expiresAt = new Date(Date.now() + 14 * 60 * 1000).toISOString()

    await mockAgent(page, [
      { frame: { type: 'typing_start' } },
      { frame: { type: 'typing_end' } },
      {
        frame: {
          type: 'agent_message',
          text: 'I am holding this for you.',
          content_payloads: [
            {
              type: 'booking_summary',
              data: {
                bookingId: 'bk_123',
                itemType: 'trip',
                itemName: 'Angkor Temple Discovery',
                travelDate: '2026-09-12',
                peopleCount: 2,
                priceBreakdown: [{ label: 'Trip x 2', amountUsd: 378 }],
                totalUsd: 378,
                holdExpiresAt: expiresAt,
              },
            },
          ],
        },
      },
    ])
    await openChatAndAsk(page, 'Hold the temple trip')

    const blocks = page.getByTestId('payload-blocks')
    await expect(blocks.getByText('Angkor Temple Discovery')).toBeVisible({ timeout: 15_000 })
    await expect(blocks.getByText(/1[34]m \d+s/)).toBeVisible()

    await expect(blocks.getByRole('button', { name: /confirm booking/i })).toBeEnabled()
    await expect(blocks.getByRole('link', { name: /view booking/i })).toHaveAttribute(
      'href',
      '/en/bookings/bk_123',
    )
  })

  test('an expired hold cannot be confirmed', async ({ page }) => {
    const expiredAt = new Date(Date.now() - 60 * 1000).toISOString()

    await mockAgent(page, [
      { frame: { type: 'typing_start' } },
      { frame: { type: 'typing_end' } },
      {
        frame: {
          type: 'agent_message',
          text: 'That hold has lapsed.',
          content_payloads: [
            {
              type: 'booking_summary',
              data: {
                bookingId: 'bk_123',
                itemType: 'trip',
                itemName: 'Angkor Temple Discovery',
                travelDate: '2026-09-12',
                peopleCount: 2,
                priceBreakdown: [],
                totalUsd: 378,
                holdExpiresAt: expiredAt,
              },
            },
          ],
        },
      },
    ])
    await openChatAndAsk(page, 'Confirm my hold')

    const blocks = page.getByTestId('payload-blocks')
    await expect(blocks.getByText(/hold expired/i)).toBeVisible({ timeout: 15_000 })
    // Offering a button the server will reject is worse than disabling it.
    await expect(blocks.getByRole('button', { name: /confirm booking/i })).toBeDisabled()
  })

  test('the card block shows a sandbox notice and no card fields', async ({ page }) => {
    await mockAgent(page, [
      { frame: { type: 'typing_start' } },
      { frame: { type: 'typing_end' } },
      {
        frame: {
          type: 'agent_message',
          text: 'Ready to pay.',
          content_payloads: [
            { type: 'stripe_card_form', data: { bookingId: 'bk_123', amount: { usd: 378 } } },
          ],
        },
      },
    ])
    await openChatAndAsk(page, 'Pay by card')

    const blocks = page.getByTestId('payload-blocks')
    await expect(blocks.getByText(/demo mode/i)).toBeVisible({ timeout: 15_000 })

    /*
     * No card inputs exist anywhere: there is no PaymentIntent endpoint, so a card
     * field would go nowhere and would invite real card details into a dead form.
     */
    await expect(blocks.locator('input')).toHaveCount(0)
  })

  test('a guest is asked to sign in rather than offered a doomed payment button', async ({
    page,
  }) => {
    await mockAgent(page, [
      { frame: { type: 'typing_start' } },
      { frame: { type: 'typing_end' } },
      {
        frame: {
          type: 'agent_message',
          text: 'Scan to pay.',
          content_payloads: [
            {
              type: 'qr_payment',
              data: {
                qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=pay',
                amount: { usd: 378 },
                expiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                paymentIntentId: 'pi_1',
                bookingId: 'bk_123',
              },
            },
          ],
        },
      },
    ])
    await openChatAndAsk(page, 'Pay with QR')

    const blocks = page.getByTestId('payload-blocks')
    await expect(blocks.getByAltText(/scan qr/i)).toBeVisible({ timeout: 15_000 })

    // The agent refuses payment claims from unauthenticated sessions.
    await expect(blocks.getByRole('button', { name: /i've paid/i })).toHaveCount(0)
    await expect(blocks.getByRole('link', { name: /sign in to confirm payment/i })).toHaveAttribute(
      'href',
      '/en/login',
    )
  })

  test('renders a confirmed booking with its reference', async ({ page }) => {
    await mockAgent(page, [
      { frame: { type: 'typing_start' } },
      { frame: { type: 'typing_end' } },
      {
        frame: {
          type: 'agent_message',
          text: 'All set!',
          content_payloads: [
            {
              type: 'booking_confirmed',
              data: {
                bookingRef: 'DERLG-4821',
                tripName: 'Angkor Temple Discovery',
                travelDate: '2026-09-12',
              },
            },
          ],
        },
      },
    ])
    await openChatAndAsk(page, 'Confirm it')

    const blocks = page.getByTestId('payload-blocks')
    await expect(blocks.getByText('DERLG-4821')).toBeVisible({ timeout: 15_000 })
    await expect(blocks.getByText(/booking confirmed/i)).toBeVisible()
  })

  test('renders a rich multi-block reply: weather, budget, itinerary and a map', async ({
    page,
  }) => {
    await mockAgent(page, [
      { frame: { type: 'typing_start' } },
      { frame: { type: 'typing_end' } },
      {
        frame: {
          type: 'agent_message',
          text: 'Here is a full plan.',
          content_payloads: [
            {
              type: 'weather',
              data: {
                forecast: [
                  { date: '2026-08-02', high: 33, low: 25, condition: 'Sunny' },
                  { date: '2026-08-03', high: 32, low: 24, condition: 'Showers' },
                ],
              },
            },
            {
              type: 'budget_estimate',
              data: { totalUsd: 480, breakdown: { accommodation: 200, food_drink: 120 } },
            },
            {
              type: 'itinerary',
              data: {
                days: [{ day: 1, title: 'Arrive in Siem Reap', activities: ['Airport pickup'] }],
              },
            },
            {
              type: 'map_view',
              data: {
                center: { lat: 13.41, lng: 103.86 },
                markers: [{ id: 'm1', lat: 13.41, lng: 103.86, label: 'Angkor Wat', type: 'trip' }],
              },
            },
          ],
        },
      },
    ])
    await openChatAndAsk(page, 'Plan my trip')

    const blocks = page.getByTestId('payload-blocks')
    await expect(blocks).toBeVisible({ timeout: 15_000 })

    // This is the shape of a real multi-tool turn, which the agent produces often
    // because it auto-derives a map whenever anything carries coordinates.
    await expect(blocks.getByText('Sunny')).toBeVisible()
    await expect(blocks.getByText('Showers')).toBeVisible()
    await expect(blocks.getByText('Accommodation')).toBeVisible()
    await expect(blocks.getByText(/\$480/)).toBeVisible()
    await expect(blocks.getByText(/Airport pickup/)).toBeVisible()

    // The real Leaflet map, with real OpenStreetMap tiles.
    await expect(blocks.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 })
    await expect(blocks.locator('img.leaflet-tile').first()).toBeVisible({ timeout: 15_000 })
  })

  test('renders a trip detail block with its itinerary and inclusions', async ({ page }) => {
    await mockAgent(page, [
      { frame: { type: 'typing_start' } },
      { frame: { type: 'typing_end' } },
      {
        frame: {
          type: 'agent_message',
          text: 'Here are the details.',
          content_payloads: [
            {
              type: 'trip_detail',
              data: {
                id: 'trip-1',
                name: 'Angkor Temple Discovery',
                priceUsd: 189,
                durationDays: 3,
                description: 'Three unhurried days among the temples.',
                included: ['English-speaking guide'],
                excluded: ['International flights'],
                itinerary: [{ day: 1, title: 'Arrive in Siem Reap' }],
              },
            },
          ],
        },
      },
    ])
    await openChatAndAsk(page, 'Tell me about the temple trip')

    const blocks = page.getByTestId('payload-blocks')
    await expect(blocks.getByRole('heading', { name: 'Angkor Temple Discovery' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(blocks.getByText('Day 1')).toBeVisible()
    await expect(blocks.getByText('English-speaking guide')).toBeVisible()
    await expect(blocks.getByText('International flights')).toBeVisible()
    await expect(blocks.getByRole('link', { name: /view details/i })).toHaveAttribute(
      'href',
      '/en/trips/trip-1',
    )
  })

  test('offers the follow-up suggestions and sends the chosen one', async ({ page }) => {
    await mockAgent(page, FULL_TURN)
    await openChatAndAsk(page)

    const suggestion = page.getByRole('button', { name: 'Show hotels nearby' })
    await expect(suggestion).toBeVisible({ timeout: 15_000 })

    await suggestion.click()
    // It becomes the next user message.
    await expect(page.getByText('Show hotels nearby', { exact: true }).first()).toBeVisible()
  })

  test('records feedback and thanks the user', async ({ page }) => {
    await mockAgent(page, FULL_TURN)
    await openChatAndAsk(page)

    await expect(page.getByText('I found three temple trips for you.')).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('button', { name: /yes, helpful/i }).last().click()
    await expect(page.getByText(/thanks for your feedback/i)).toBeVisible()
  })

  test('surfaces an agent error and abandons the partial reply', async ({ page }) => {
    await mockAgent(page, [
      { frame: { type: 'typing_start' } },
      { frame: { type: 'agent_stream_chunk', content: 'Let me check' } },
      { frame: { type: 'typing_end' } },
      { frame: { type: 'error', message: 'Something went wrong. Please try again.' } },
    ])
    await openChatAndAsk(page)

    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)')
    await expect(alert).toContainText(/something went wrong/i, { timeout: 15_000 })

    // A half-streamed answer left beside an error would read as truth.
    await expect(page.getByLabel(/concierge is replying/i)).toBeHidden()
  })

  test('prompts sign-in when the agent gates on login', async ({ page }) => {
    await mockAgent(page, [
      { frame: { type: 'typing_start' } },
      { frame: { type: 'requires_login', message: 'Please sign in to book.' } },
    ])
    await openChatAndAsk(page, 'Book the temple tour')

    await expect(page.getByRole('paragraph').filter({ hasText: 'Sign in to book' })).toBeVisible({
      timeout: 15_000,
    })
    /*
     * Scoped to the transcript: the header also shows a guest "Sign in" link, so an
     * unscoped locator matches two elements.
     */
    const transcript = page.getByRole('list', { name: 'Conversation' })
    await expect(transcript.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/en/login',
    )
  })

  test('links to the booking when the agent gates on payment', async ({ page }) => {
    await mockAgent(page, [
      { frame: { type: 'typing_start' } },
      { frame: { type: 'typing_end' } },
      { frame: { type: 'requires_payment', booking_id: 'bk_123', amount_usd: 189 } },
      { frame: { type: 'agent_message', text: 'Your hold is ready to pay.' } },
    ])
    await openChatAndAsk(page, 'Book it')

    await expect(page.getByRole('link', { name: /confirm booking/i })).toHaveAttribute(
      'href',
      '/en/bookings/bk_123',
    )
  })

  test('rendered payload blocks have no critical or serious a11y violations', async ({ page }) => {
    await mockAgent(page, [
      { frame: { type: 'typing_start' } },
      { frame: { type: 'typing_end' } },
      {
        frame: {
          type: 'agent_message',
          text: 'Here is a full plan.',
          content_payloads: [
            {
              type: 'trip_cards',
              data: {
                trips: [
                  {
                    id: 'trip-1',
                    name: 'Angkor Temple Discovery',
                    priceUsd: 189,
                    durationDays: 3,
                    imageUrl: 'http://localhost:9000/derlg/trip-1.jpg',
                  },
                ],
              },
            },
            {
              type: 'weather',
              data: { forecast: [{ date: '2026-08-02', high: 33, low: 25, condition: 'Sunny' }] },
            },
            { type: 'budget_estimate', data: { totalUsd: 480, breakdown: { accommodation: 200 } } },
            {
              type: 'image_gallery',
              data: { images: [{ url: 'http://localhost:9000/derlg/trip-1.jpg', caption: 'Bayon' }] },
            },
            {
              type: 'itinerary',
              data: { days: [{ day: 1, title: 'Arrive', activities: ['Airport pickup'] }] },
            },
            {
              type: 'map_view',
              data: {
                center: { lat: 13.41, lng: 103.86 },
                markers: [{ id: 'm1', lat: 13.41, lng: 103.86, label: 'Angkor Wat' }],
              },
            },
          ],
        },
      },
    ])
    await openChatAndAsk(page, 'Plan my trip')
    await expect(page.getByTestId('payload-blocks')).toBeVisible({ timeout: 15_000 })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Leaflet's own zoom controls are third-party markup we do not author.
      .exclude('.leaflet-control-container')
      .analyze()

    const serious = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(serious).toEqual([])
  })

  test('resuming a conversation does not duplicate the greeting', async ({ page }) => {
    await mockAgent(page, FULL_TURN)
    await openChatAndAsk(page)

    await expect(page.getByText('I found three temple trips for you.')).toBeVisible({
      timeout: 15_000,
    })

    // Exactly one greeting, even though the handshake replays it on every connect.
    await expect(page.getByText('Welcome to DerLg!')).toHaveCount(1)
  })
})
