/**
 * Task 20.10 — Accessibility audit (axe-core) for the Vibe Booking route.
 *
 * Runs axe-core against `/vibe-booking` in its settled welcome state and asserts
 * zero accessibility violations. We audit BOTH rendered layouts because the page
 * mounts a desktop split-screen tree (`hidden md:block`) and a mobile stacked
 * tree (`md:hidden`) simultaneously; only one is visible per viewport and
 * axe-core ignores the `display:none` branch, so each viewport audits a distinct
 * surface (chat dialog + content stage vs. stacked single-pane).
 *
 * Like the other specs in this directory, the Python AI agent on
 * `ws://localhost:8000/ws/chat` is NOT required: a minimal in-browser mock of
 * `window.WebSocket` is injected before app JS runs (`addInitScript`). It opens,
 * answers `auth` with `conversation_started`, and replies to `ping` with `pong`,
 * which is enough to flip the connection status to "connected" and render the
 * localized welcome placeholder + suggested-prompt chips — a stable, fully
 * hydrated UI for the audit (no reconnect timers firing mid-scan).
 */
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Install a minimal deterministic mock of `window.WebSocket`.
 *
 * Only the frames needed to reach the settled welcome state are scripted:
 *   client → server : auth, ping
 *   server → client : conversation_started, pong
 */
async function installMockWebSocket(page: Page): Promise<void> {
  await page.addInitScript(() => {
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
        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN
          this.onopen?.()
        }, 0)
      }

      private emit(obj: unknown) {
        setTimeout(() => this.onmessage?.({ data: JSON.stringify(obj) }), 5)
      }

      send(raw: string) {
        let msg: { type?: string }
        try {
          msg = JSON.parse(raw)
        } catch {
          return
        }

        switch (msg.type) {
          case 'auth':
            this.emit({
              type: 'conversation_started',
              session_id: 'sess_a11y_0001',
              text: 'Hi! I am your DerLg concierge. Where would you like to go in Cambodia?',
              suggested_prompts: ['Show me trips to Siem Reap', 'Find hotels near Angkor Wat'],
            })
            break
          case 'ping':
            this.emit({ type: 'pong' })
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

      addEventListener() {}
      removeEventListener() {}
    }

    // @ts-expect-error - overriding the DOM global with a test double.
    window.WebSocket = MockWebSocket
  })
}

test.describe('Vibe Booking — accessibility (axe-core)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockWebSocket(page)
  })

  test('desktop split-screen layout has no axe violations', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/vibe-booking')

    // Page settled: socket connected (chat dialog fully rendered).
    await expect(page.getByText('Connected', { exact: true }).locator('visible=true')).toBeVisible()
    // Chat panel dialog present on desktop.
    await expect(page.getByRole('dialog', { name: /concierge/i })).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()

    expect(results.violations).toEqual([])
  })

  test('mobile stacked layout has no axe violations', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/vibe-booking')

    await expect(page.getByText('Connected', { exact: true }).locator('visible=true')).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()

    expect(results.violations).toEqual([])
  })
})
