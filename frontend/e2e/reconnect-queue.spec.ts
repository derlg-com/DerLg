/**
 * Task 18.2.9 — E2E (Playwright): WebSocket auto-reconnect + offline message queue.
 *
 * Exercises the REAL `hooks/useWebSocket.ts` running inside the production build
 * of the `/vibe-booking` page, against a deterministic in-browser mock of
 * `window.WebSocket`. The mock is injected with `page.addInitScript` before any
 * app JS runs — the SAME approach used by `booking-flow.spec.ts` — but this mock
 * is *controllable*: the test can observe every frame the app sends, force a
 * server-side close, block the next connection from opening, and silently drop a
 * live socket (readyState ≠ OPEN without firing `onclose`).
 *
 * Behaviours under test (Requirements doc §"WebSocket Protocol" #7/#8 and
 * §"Error Handling" #10/#11; mirrors the unit suite tests/use-websocket.test.ts
 * Req 28.2/28.3 and 28.6/28.9 at the browser level):
 *
 *   a. Auto-reconnect — on an unexpected socket close the hook flips the status
 *      to "disconnected", then reconnects with exponential backoff
 *      (delay = min(1000 * 2**retries, 30000); first delay = 1s). After the
 *      socket reopens the status returns to "connected", `retries` resets, and a
 *      fresh `auth` frame is re-sent. Playwright's clock is used to fast-forward
 *      the 1s backoff timer so the test is deterministic (no wall-clock waits).
 *
 *   b. Offline message queue — when the socket is NOT open, sending a
 *      `user_message` pushes it to an outbox persisted in localStorage under
 *      `derlg:vibe-booking:outbox`; nothing is lost. On reconnect `flushOutbox()`
 *      drains the queue in FIFO order, the mock receives the previously-queued
 *      `user_message`, and the persisted outbox is emptied.
 *
 * IMPORTANT: this spec asserts the *existing* hook behaviour. It never patches
 * `useWebSocket.ts` to make a test pass.
 */
import { test, expect, type Page } from '@playwright/test'

const OUTBOX_KEY = 'derlg:vibe-booking:outbox'

/**
 * Install a controllable in-browser mock of `window.WebSocket`.
 *
 * A registry is published on `window.__vibeMock` so the test can drive the
 * socket lifecycle deterministically and inspect what the app sent:
 *
 *   instances           – every MockWebSocket constructed (newest last)
 *   active()            – the most recently constructed socket
 *   sentTypes()         – frame `type`s sent across ALL sockets (chronological)
 *   authCount()         – how many `auth` frames the app has sent (per (re)open)
 *   userMessages()      – payloads of every `user_message` frame the app sent
 *   blockOpen           – when true, newly constructed sockets do NOT auto-open
 *                         (simulates "server refuses the connection")
 *   serverClose()       – force-close the active socket (fires the app's onclose
 *                         → drives the backoff reconnect)
 *   dropSilently()      – set the active socket's readyState to CLOSED WITHOUT
 *                         firing onclose, modelling the brief window where a send
 *                         races a dying link: the store still reads "connected"
 *                         (so the chat input stays enabled) but `send()` sees a
 *                         non-OPEN socket and must queue.
 */
async function installControllableMockWebSocket(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Listener = (ev: { data: string }) => void

    interface Registry {
      instances: MockWebSocket[]
      blockOpen: boolean
      active: () => MockWebSocket | undefined
      sentTypes: () => string[]
      authCount: () => number
      userMessages: () => Array<Record<string, unknown>>
      serverClose: () => void
      dropSilently: () => void
      fireClose: () => void
    }

    // All frames the app has sent, across every (re)connected socket. Used to
    // count `auth` re-sends and to read queued `user_message` payloads.
    const allSent: Array<Record<string, unknown>> = []

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
        registry.instances.push(this)
        // Open on the next tick unless the test is simulating a server that
        // refuses connections. `setTimeout(…, 0)` is faked by page.clock when
        // installed, so the reconnect test flushes it with clock.runFor.
        setTimeout(() => {
          if (registry.blockOpen) return
          if (this.readyState !== MockWebSocket.CONNECTING) return
          this.readyState = MockWebSocket.OPEN
          this.onopen?.()
        }, 0)
      }

      /** Push a server→client frame into the app (deferred for async realism). */
      private emit(obj: unknown) {
        setTimeout(() => this.onmessage?.({ data: JSON.stringify(obj) }), 1)
      }

      send(raw: string) {
        let msg: Record<string, unknown>
        try {
          msg = JSON.parse(raw) as Record<string, unknown>
        } catch {
          return
        }
        allSent.push(msg)

        switch (msg.type) {
          case 'auth':
            // Mirror the agent handshake so the app marks the session ready.
            this.emit({
              type: 'conversation_started',
              session_id: 'sess_reconnect_0001',
              text: 'Concierge online. Where to in Cambodia?',
              suggested_prompts: ['Trips to Siem Reap'],
            })
            break
          case 'ping':
            // Answer heartbeats so the liveness timer never force-closes us.
            this.emit({ type: 'pong' })
            break
          default:
            // user_message / user_action / etc. are recorded in `allSent`;
            // no scripted server reply is needed for these assertions.
            break
        }
      }

      close() {
        if (this.readyState === MockWebSocket.CLOSED) return
        this.readyState = MockWebSocket.CLOSED
        this.onclose?.()
      }

      addEventListener() {}
      removeEventListener() {}
    }

    const registry: Registry = {
      instances: [],
      blockOpen: false,
      active: () => registry.instances[registry.instances.length - 1],
      sentTypes: () => allSent.map((m) => String(m.type)),
      authCount: () => allSent.filter((m) => m.type === 'auth').length,
      userMessages: () => allSent.filter((m) => m.type === 'user_message'),
      serverClose: () => {
        const s = registry.active()
        if (s && s.readyState !== MockWebSocket.CLOSED) {
          s.readyState = MockWebSocket.CLOSED
          s.onclose?.()
        }
      },
      dropSilently: () => {
        const s = registry.active()
        // Report the link as gone to `send()` (readyState ≠ OPEN) WITHOUT
        // notifying the app via onclose — so the store stays "connected" and the
        // chat input remains enabled while the next send is forced to queue.
        if (s) s.readyState = MockWebSocket.CLOSED
      },
      fireClose: () => {
        // Deliver the close event to the app unconditionally (even if the socket
        // was already silently dropped via dropSilently()), driving the hook's
        // onclose → backoff reconnect. Used to "recover" after an offline window.
        const s = registry.active()
        if (s) {
          s.readyState = MockWebSocket.CLOSED
          s.onclose?.()
        }
      },
    }

    // @ts-expect-error - publish the test control surface on window.
    window.__vibeMock = registry
    // @ts-expect-error - overriding the DOM global with a test double.
    window.WebSocket = MockWebSocket
  })
}

/** Test-side typed view of the in-page control surface. */
type MockHandle = {
  active: () => unknown
  sentTypes: () => string[]
  authCount: () => number
  userMessages: () => Array<Record<string, unknown>>
  serverClose: () => void
  dropSilently: () => void
  fireClose: () => void
  blockOpen: boolean
}

const authCount = (page: Page) =>
  page.evaluate(() => (window as unknown as { __vibeMock: MockHandle }).__vibeMock.authCount())

const sentUserMessages = (page: Page) =>
  page.evaluate(() => (window as unknown as { __vibeMock: MockHandle }).__vibeMock.userMessages())

const readOutbox = (page: Page) =>
  page.evaluate((key) => window.localStorage.getItem(key), OUTBOX_KEY)

/** Desktop viewport so the split-screen layout (not the mobile stack) renders. */
test.use({ viewport: { width: 1280, height: 900 } })

test.describe('Vibe Booking — auto-reconnect & offline message queue (mocked WS)', () => {
  test.beforeEach(async ({ page }) => {
    await installControllableMockWebSocket(page)
  })

  test('auto-reconnects with backoff and re-sends auth after an unexpected close', async ({
    page,
  }) => {
    // Fake timers so the hook's exponential-backoff setTimeout (first delay = 1s)
    // is driven deterministically — no real 1s/16s/30s waits. Installed before
    // navigation so the app and the mock share the same faked clock.
    await page.clock.install()

    // Only the desktop layout is visible at this viewport; scope every locator to
    // `visible=true` to avoid matching the hidden mobile duplicate.
    const connectedBadge = page.getByText('Connected', { exact: true }).locator('visible=true')
    const disconnectedBadge = page
      .getByText('Disconnected', { exact: true })
      .locator('visible=true')

    await page.goto('/vibe-booking')

    // Flush the mock's queued open (setTimeout 0) + the conversation_started
    // emit (setTimeout 1) under the faked clock so the connection establishes.
    await page.clock.runFor(20)

    await expect(connectedBadge).toBeVisible()
    // Exactly one auth frame after the first successful open.
    expect(await authCount(page)).toBe(1)

    // Simulate a server-side drop: the active socket closes unexpectedly.
    await page.evaluate(() =>
      (window as unknown as { __vibeMock: MockHandle }).__vibeMock.serverClose(),
    )

    // onclose → status flips to disconnected and the chat input gates closed.
    await expect(disconnectedBadge).toBeVisible()

    // The hook schedules reconnect at delay = min(1000 * 2**0, 30000) = 1000ms.
    // Fast-forward exactly past the first backoff so a new socket is constructed,
    // then flush its open + handshake emits.
    await page.clock.fastForward(1000)
    await page.clock.runFor(20)

    // Reconnected: status returns to connected and a SECOND auth frame is sent on
    // reopen (retries reset to 0). This is the core auto-reconnect contract.
    await expect(connectedBadge).toBeVisible()
    expect(await authCount(page)).toBe(2)
  })

  test('queues a chat message while offline and flushes it (FIFO) on reconnect', async ({
    page,
  }) => {
    const connectedBadge = page.getByText('Connected', { exact: true }).locator('visible=true')

    await page.goto('/vibe-booking')

    // Establish the (mock) connection so the chat input is enabled.
    await expect(connectedBadge).toBeVisible()

    const input = page.getByTestId('multimodal-input').locator('visible=true')
    const sendButton = page.getByTestId('send-button').locator('visible=true')
    await expect(input).toBeEnabled()

    // Outbox holds nothing queued on a healthy connection. (flushOutbox() runs
    // on the first open and persists an empty array, so the key may be unset OR
    // the string "[]" — both mean "zero queued messages".)
    const initialOutbox = await readOutbox(page)
    expect(initialOutbox === null || initialOutbox === '[]').toBe(true)

    // Drop the live socket *silently*: readyState becomes CLOSED but onclose is
    // NOT fired, so the store still reads "connected" and the input stays enabled
    // — modelling a send that races a dying link. The next send must queue.
    await page.evaluate(() =>
      (window as unknown as { __vibeMock: MockHandle }).__vibeMock.dropSilently(),
    )

    const OFFLINE_TEXT = 'Plan a 3-day Siem Reap trip while my connection is flaky'
    await input.click()
    await input.fill(OFFLINE_TEXT)
    await expect(sendButton).toBeEnabled()
    await sendButton.click()

    // The optimistic echo still renders (sendMessage always adds the user bubble).
    await expect(page.locator(`text=${OFFLINE_TEXT} >> visible=true`)).toBeVisible()

    // Critically, the message is NOT lost — it is persisted to the outbox because
    // the socket was not OPEN when send() ran. (user_message is queueable.)
    await expect
      .poll(async () => {
        const raw = await readOutbox(page)
        if (!raw) return 0
        try {
          return (JSON.parse(raw) as unknown[]).length
        } catch {
          return -1
        }
      })
      .toBe(1)

    const queued = JSON.parse((await readOutbox(page)) as string) as Array<Record<string, unknown>>
    expect(queued[0]).toMatchObject({ type: 'user_message', content: OFFLINE_TEXT })

    // It has NOT yet been delivered to any socket.
    expect(await sentUserMessages(page)).toHaveLength(0)

    // Now let the link recover: deliver the close event so the hook reconnects,
    // constructs a fresh socket, reopens, and flushOutbox() drains the queue.
    // (fireClose fires onclose unconditionally — the socket was already CLOSED
    // from dropSilently, so serverClose's "skip if closed" guard wouldn't fire.)
    await page.evaluate(() =>
      (window as unknown as { __vibeMock: MockHandle }).__vibeMock.fireClose(),
    )

    // The reconnect backoff is 1s; without faked timers we simply wait for the
    // status to return to connected (well within the 60s test timeout).
    await expect(connectedBadge).toBeVisible({ timeout: 15_000 })

    // flushOutbox() delivered the previously-queued user_message to the mock…
    await expect
      .poll(async () => (await sentUserMessages(page)).length, { timeout: 15_000 })
      .toBe(1)
    const delivered = await sentUserMessages(page)
    expect(delivered[0]).toMatchObject({ type: 'user_message', content: OFFLINE_TEXT })

    // …and the persisted outbox is now empty (re-saved after the drain).
    expect(await readOutbox(page)).toBe('[]')
  })
})
