import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * The trip workspace, against a SCRIPTED agent.
 *
 * The unit tests cover `deriveWorkspace` in isolation and the panel with props.
 * What only a browser can prove is the part that goes wrong in integration: that
 * the rail and the mobile sheet are the SAME state, that the panel survives the
 * real frame sequence, and that a payment claim fires exactly once even though
 * the panel is mounted twice.
 */

const SESSION = '22222222-2222-4222-8222-222222222222'

type Frame = Record<string, unknown>

/** Frames the client sent, so "how many times" is assertable. */
type Sent = { type: string; [key: string]: unknown }

/**
 * Serves the chat WebSocket from Node and records what the client sent.
 *
 * The route handler runs in Node, not the page, so frames are captured by pushing
 * straight onto a closure array. An earlier version round-tripped each message
 * through `page.exposeFunction`, which added an async hop per frame and made the
 * handshake race the greeting assertion under parallel load.
 */
async function mockAgent(
  page: Page,
  replyFrames: { frame: Frame; delayMs?: number }[],
): Promise<Sent[]> {
  const sent: Sent[] = []

  await page.routeWebSocket(/ws\/chat/, (ws) => {
    ws.onMessage((raw) => {
      const message = JSON.parse(String(raw)) as Sent
      sent.push(message)

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
          elapsed += step.delayMs ?? 40
          setTimeout(() => ws.send(JSON.stringify(step.frame)), elapsed)
        }
      }
    })
  })

  return sent
}

function reply(payloads: Frame[], text = 'Here you go.') {
  return [
    { frame: { type: 'typing_start' } },
    { frame: { type: 'typing_end' } },
    { frame: { type: 'agent_message', text, content_payloads: payloads, message_id: 'm1' } },
  ]
}

const TRIP_DETAIL = {
  type: 'trip_detail',
  data: {
    id: 'trip-1',
    name: 'Bokor Mountain Escape',
    priceUsd: 120,
    durationDays: 2,
    lat: 10.6,
    lng: 104.05,
    itinerary: [{ day: 1, title: 'Drive up Bokor', description: 'Sunset at the plateau' }],
  },
}

async function ask(page: Page, text = 'Show me option one') {
  await page.goto('/en/chat')
  await expect(page.getByText('Welcome to DerLg!')).toBeVisible({ timeout: 15_000 })
  const composer = page.getByLabel(/message the concierge/i)
  await composer.fill(text)
  await composer.press('Enter')
}

/**
 * The VISIBLE workspace for the current viewport.
 *
 * Both presentations are mounted at once — the desktop rail is hidden with CSS,
 * not unmounted — so a bare `getByTestId` would happily resolve to the invisible
 * one on a phone. On mobile the workspace lives behind the pill, so this opens it.
 */
async function openWorkspace(page: Page, isMobile: boolean | undefined) {
  if (!isMobile) {
    return page
      .getByRole('complementary', { name: /trip workspace/i })
      .getByTestId('workspace-panel')
  }

  const pill = page.getByRole('button', { name: /open trip workspace/i })
  await expect(pill).toBeVisible()
  await pill.click()
  return page.getByRole('dialog').getByTestId('workspace-panel')
}

test.describe('trip workspace', () => {
  test('starts empty and says so', async ({ page, isMobile }) => {
    await mockAgent(page, [])
    await page.goto('/en/chat')
    await expect(page.getByText('Welcome to DerLg!')).toBeVisible({ timeout: 15_000 })

    if (isMobile) {
      // With nothing pinned there is no pill: an empty sheet is not worth a tap.
      await expect(page.getByRole('button', { name: /open trip workspace/i })).toBeHidden()
      return
    }

    // Honest about being empty rather than showing a blank frame.
    const workspace = await openWorkspace(page, isMobile)
    await expect(workspace.getByText(/nothing selected yet/i)).toBeVisible()
  })

  test('offers the vibe starter, and it composes a real prompt', async ({ page }) => {
    const sent = await mockAgent(page, reply([TRIP_DETAIL]))
    await page.goto('/en/chat')
    await expect(page.getByText('Welcome to DerLg!')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Temples' }).click()
    await page.getByRole('button', { name: '3 days' }).click()
    await page.getByRole('button', { name: /ask the concierge/i }).click()

    await expect.poll(() => sent.filter((m) => m.type === 'user_message').length).toBe(1)
    const message = sent.find((m) => m.type === 'user_message')
    expect(String(message?.content)).toContain('temples and history')
    expect(String(message?.content)).toContain('3 days')

    // The starter is a first-turn affordance; it retires once asked.
    await expect(page.getByTestId('vibe-starter')).toBeHidden()
  })

  test('pins the selected trip, its itinerary and its map into the workspace', async ({
    page,
    isMobile,
  }) => {
    await mockAgent(page, reply([TRIP_DETAIL]))
    await ask(page)

    const workspace = await openWorkspace(page, isMobile)
    await expect(workspace.getByText('Selected trip')).toBeVisible()
    await expect(workspace.getByText('Bokor Mountain Escape')).toBeVisible()
    await expect(workspace.getByText('Day 1')).toBeVisible()

    // A located subject gets a real Google Maps handoff, not raw coordinates.
    const maps = workspace.getByRole('link', { name: /google maps/i }).first()
    await expect(maps).toHaveAttribute('href', /google\.com\/maps/)
    await expect(maps).toHaveAttribute('target', '_blank')
    await expect(maps).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('replaces the pinned subject when the user changes their mind', async ({
    page,
    isMobile,
  }) => {
    await mockAgent(page, [
      ...reply([TRIP_DETAIL]),
      {
        frame: {
          type: 'agent_message',
          text: 'And the hotel.',
          message_id: 'm2',
          content_payloads: [
            {
              type: 'hotel_detail',
              data: { id: 'hotel-9', name: 'Riverside Boutique', priceUsd: 48 },
            },
          ],
        },
        delayMs: 250,
      },
    ])
    await ask(page)
    await expect(page.getByText('And the hotel.')).toBeVisible()

    const workspace = await openWorkspace(page, isMobile)
    await expect(workspace.getByText('Selected hotel')).toBeVisible()
    await expect(workspace.getByText('Riverside Boutique')).toBeVisible()
    // The newer subject wins outright; the old one is not left alongside it.
    await expect(workspace.getByText('Selected trip')).toBeHidden()
  })

  test('keeps the hold facts and a live countdown pinned', async ({ page, isMobile }) => {
    const expiry = new Date(Date.now() + 12 * 60_000).toISOString()
    await mockAgent(
      page,
      reply([
        {
          type: 'booking_summary',
          data: {
            bookingId: 'booking-1',
            itemType: 'trip',
            itemName: 'Bokor Mountain Escape',
            travelDate: '2026-02-14',
            peopleCount: 2,
            priceBreakdown: [{ label: 'Total', amountUsd: 240 }],
            totalUsd: 240,
            holdExpiresAt: expiry,
          },
        },
      ]),
    )
    await ask(page, 'Hold it for me')

    const workspace = await openWorkspace(page, isMobile)
    await expect(workspace.getByText(/expires in \d+m/i)).toBeVisible()
    // The hold now carries the real facts, not the blank fields it used to.
    await expect(workspace.getByText('2026', { exact: false })).toBeVisible()
    await expect(workspace.getByRole('button', { name: /pay now/i })).toBeEnabled()
  })

  test('an expired hold offers no payment action', async ({ page, isMobile }) => {
    await mockAgent(
      page,
      reply([
        {
          type: 'booking_summary',
          data: {
            bookingId: 'booking-1',
            itemType: 'trip',
            itemName: 'Bokor Mountain Escape',
            travelDate: '2026-02-14',
            peopleCount: 2,
            priceBreakdown: [{ label: 'Total', amountUsd: 240 }],
            totalUsd: 240,
            holdExpiresAt: new Date(Date.now() - 60_000).toISOString(),
          },
        },
      ]),
    )
    await ask(page, 'Hold it for me')

    const workspace = await openWorkspace(page, isMobile)
    await expect(workspace.getByRole('button', { name: /hold expired/i })).toBeDisabled()
  })

  test('a guest is offered sign-in, never a payment claim', async ({ page, isMobile }) => {
    await mockAgent(
      page,
      reply([
        {
          type: 'qr_payment',
          data: {
            qrUrl: 'http://localhost:9000/derlg/qr.png',
            amount: { usd: 240 },
            expiry: new Date(Date.now() + 10 * 60_000).toISOString(),
            paymentIntentId: 'pi_1',
            bookingId: 'booking-1',
          },
        },
      ]),
    )
    await ask(page, 'How do I pay?')

    const workspace = await openWorkspace(page, isMobile)
    // The agent rejects guest payment claims, so a claim button would be a trap.
    await expect(workspace.getByRole('button', { name: /i've paid/i })).toBeHidden()
    await expect(workspace.getByRole('link', { name: /sign in to confirm payment/i })).toBeVisible()
  })

  test('never reports success from an older status on a newer unpaid payment', async ({
    page,
    isMobile,
  }) => {
    await mockAgent(page, [
      ...reply(
        [
          {
            type: 'payment_status',
            data: {
              paymentIntentId: 'pi_OLD',
              bookingId: 'booking-OLD',
              status: 'SUCCEEDED',
              amountUsd: 10,
            },
          },
        ],
        'That earlier one is paid.',
      ),
      {
        frame: {
          type: 'agent_message',
          text: 'Here is the code for the new booking.',
          message_id: 'm2',
          content_payloads: [
            {
              type: 'qr_payment',
              data: {
                qrUrl: 'http://localhost:9000/derlg/qr.png',
                amount: { usd: 500 },
                expiry: new Date(Date.now() + 10 * 60_000).toISOString(),
                paymentIntentId: 'pi_NEW',
                bookingId: 'booking-NEW',
              },
            },
          ],
        },
        delayMs: 250,
      },
    ])
    await ask(page, 'Pay for the new one')
    await expect(page.getByText('Here is the code for the new booking.')).toBeVisible()

    const workspace = await openWorkspace(page, isMobile)
    // The single worst possible bug: announcing payment for an unpaid booking.
    await expect(workspace.getByText(/payment successful/i)).toBeHidden()
    await expect(workspace.getByText(/pending/i).first()).toBeVisible()
    await expect(workspace.getByAltText(/scan qr/i)).toBeVisible()
  })

  test('a confirmed booking shows its reference', async ({ page, isMobile }) => {
    await mockAgent(
      page,
      reply([
        {
          type: 'booking_confirmed',
          data: {
            bookingRef: 'DLG-2026-45678',
            tripName: 'Bokor Mountain Escape',
            travelDate: '2026-02-14',
          },
        },
      ]),
    )
    await ask(page, 'Did it go through?')

    const workspace = await openWorkspace(page, isMobile)
    await expect(workspace.getByText('DLG-2026-45678')).toBeVisible()
  })

  test('the comparison block renders an aligned table with the cheapest marked', async ({
    page,
  }) => {
    await mockAgent(
      page,
      reply([
        {
          type: 'comparison',
          data: {
            items: [
              { id: 't1', name: 'Bokor Mountain Escape', priceUsd: 120, durationDays: 2, rating: 4.8 },
              { id: 't2', name: 'Kampot Relaxing Escape', priceUsd: 95, durationDays: 3, rating: 4.6 },
            ],
          },
        },
      ]),
    )
    await ask(page, 'Compare those two')

    const table = page.getByRole('table')
    await expect(table).toBeVisible()
    await expect(table.getByRole('rowheader', { name: 'Price' })).toBeVisible()
    // "Which is cheaper?" answered without the user doing arithmetic.
    await expect(
      table.getByRole('columnheader', { name: /Kampot Relaxing Escape/ }).getByText('Cheapest'),
    ).toBeVisible()
  })

  test('a gallery photo opens full size and pages with the keyboard', async ({ page }) => {
    await mockAgent(
      page,
      reply([
        {
          type: 'image_gallery',
          data: {
            images: [
              { url: 'http://localhost:9000/derlg/a.jpg', caption: 'Bayon' },
              { url: 'http://localhost:9000/derlg/b.jpg', caption: 'Ta Prohm' },
            ],
          },
        },
      ]),
    )
    await ask(page, 'Show me photos')

    await page.getByRole('button', { name: 'Open photo 1 of 2' }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAccessibleDescription('Photo 1 of 2')

    await page.keyboard.press('ArrowRight')
    await expect(dialog).toHaveAccessibleDescription('Photo 2 of 2')

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('the workspace has no critical or serious a11y violations', async ({ page, isMobile }) => {
    await mockAgent(
      page,
      reply([
        TRIP_DETAIL,
        {
          type: 'booking_summary',
          data: {
            bookingId: 'booking-1',
            itemType: 'trip',
            itemName: 'Bokor Mountain Escape',
            travelDate: '2026-02-14',
            peopleCount: 2,
            priceBreakdown: [{ label: 'Total', amountUsd: 240 }],
            totalUsd: 240,
            holdExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          },
        },
        {
          type: 'comparison',
          data: {
            items: [
              { id: 't1', name: 'Bokor Mountain Escape', priceUsd: 120, rating: 4.8 },
              { id: 't2', name: 'Kampot Relaxing Escape', priceUsd: 95, rating: 4.6 },
            ],
          },
        },
      ]),
    )
    await ask(page, 'Show me everything')

    const workspace = await openWorkspace(page, isMobile)
    await expect(workspace).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()
    const blocking = results.violations
      .filter((v) => v.impact === 'critical' || v.impact === 'serious')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 90)).join(' | ')}`)

    expect(blocking).toEqual([])
  })
})

test.describe('trip workspace on a small screen', () => {
  test.skip(({ isMobile }) => !isMobile, 'sheet behaviour is mobile-only')

  test('reaches the same workspace through a single control', async ({ page }) => {
    await mockAgent(page, reply([TRIP_DETAIL]))
    await page.goto('/en/chat')
    await expect(page.getByText('Welcome to DerLg!')).toBeVisible({ timeout: 15_000 })

    // Nothing pinned yet, so no pill — an empty sheet is not worth a tap target.
    await expect(page.getByRole('button', { name: /open trip workspace/i })).toBeHidden()

    const composer = page.getByLabel(/message the concierge/i)
    await composer.fill('Show me option one')
    await composer.press('Enter')

    const pill = page.getByRole('button', { name: /open trip workspace/i })
    await expect(pill).toBeVisible()
    await pill.click()

    const sheet = page.getByRole('dialog')
    await expect(sheet.getByText('Bokor Mountain Escape')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
  })

  test('asking a follow-up from the sheet closes it and sends one message', async ({ page }) => {
    const sent = await mockAgent(page, reply([TRIP_DETAIL]))
    await page.goto('/en/chat')
    await expect(page.getByText('Welcome to DerLg!')).toBeVisible({ timeout: 15_000 })

    const composer = page.getByLabel(/message the concierge/i)
    await composer.fill('Show me option one')
    await composer.press('Enter')

    await page.getByRole('button', { name: /open trip workspace/i }).click()
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('button', { name: /book now/i }).click()

    // Exactly one message: the panel is mounted twice, and both copies are wired
    // to the same handler, so a duplicated send would show up here.
    await expect
      .poll(() => sent.filter((m) => m.type === 'user_message' && String(m.content).includes('book')).length)
      .toBe(1)
    await expect(sheet).toBeHidden()
  })
})
