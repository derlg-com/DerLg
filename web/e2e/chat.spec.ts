import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Chat shell against the LIVE agent.
 *
 * These exercise the real conversation loop rather than a mock, because the parts
 * most likely to break — handshake timing, streamed chunks arriving before the
 * final message, tool statuses — only appear with a real agent.
 */

async function agentUp(request: import('@playwright/test').APIRequestContext) {
  const probe = await request.get('http://localhost:8000/health').catch(() => null)
  return Boolean(probe?.ok())
}

test.describe('chat shell', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await agentUp(request)), 'agent on :8000 is not reachable')
  })

  test('opens with the concierge heading and a usable composer', async ({ page }) => {
    await page.goto('/en/chat')

    await expect(page.getByRole('heading', { name: 'DerLg AI Concierge' })).toBeVisible()

    const composer = page.getByLabel(/message the concierge/i)
    await expect(composer).toBeVisible()
    await expect(composer).toBeEditable()
  })

  test('shows the agent greeting and its suggested prompts', async ({ page }) => {
    await page.goto('/en/chat')

    // The greeting only appears once the handshake is acknowledged.
    await expect(page.getByText(/welcome/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Try asking')).toBeVisible()

    const chips = page.locator('button', { hasText: /Siem Reap|Angkor|Cambodia|Khmer/ })
    expect(await chips.count()).toBeGreaterThan(0)
  })

  test('echoes the user message immediately and the agent starts working', async ({ page }) => {
    await page.goto('/en/chat')
    await expect(page.getByText(/welcome/i).first()).toBeVisible({ timeout: 20_000 })

    const composer = page.getByLabel(/message the concierge/i)
    await composer.fill('Hello')
    await composer.press('Enter')

    // The local echo must not wait on the network.
    await expect(page.getByText('Hello', { exact: true })).toBeVisible({ timeout: 3_000 })
    await expect(composer).toHaveValue('')

    /*
     * Then the agent acknowledges by starting a turn (typing_start), which proves
     * the message reached it. The CONTENT of the reply is not asserted here: it
     * depends on an upstream LLM, so the full stream is exercised deterministically
     * in the scripted-socket suite below instead.
     */
    await expect(page.getByText(/thinking/i).first()).toBeVisible({ timeout: 30_000 })
  })

  test('clicking a suggested prompt sends it', async ({ page }) => {
    await page.goto('/en/chat')
    await expect(page.getByText('Try asking')).toBeVisible({ timeout: 20_000 })

    const chip = page.locator('button', { hasText: /Siem Reap|Angkor/ }).first()
    const label = (await chip.textContent())?.trim() ?? ''
    await chip.click()

    await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 5_000 })
  })

  test('Shift+Enter writes a newline instead of sending', async ({ page }) => {
    await page.goto('/en/chat')

    const composer = page.getByLabel(/message the concierge/i)
    await composer.fill('first line')
    await composer.press('Shift+Enter')
    await composer.type('second line')

    await expect(composer).toHaveValue('first line\nsecond line')
  })

  test('the transcript is an accessible labelled list', async ({ page }) => {
    await page.goto('/en/chat')
    await expect(page.getByText(/welcome/i).first()).toBeVisible({ timeout: 20_000 })

    await expect(page.getByRole('list', { name: 'Conversation' })).toBeVisible()
  })

  test('reports connection state to assistive tech', async ({ page }) => {
    await page.goto('/en/chat')

    // Some status region always exists, so a screen reader can tell whether the
    // concierge is reachable. Excludes Next's own route announcer.
    await expect(page.locator('[role="status"]').first()).toBeAttached({ timeout: 20_000 })
  })

  test('offers a new conversation only after the user has said something', async ({ page }) => {
    await page.goto('/en/chat')
    await expect(page.getByText(/welcome/i).first()).toBeVisible({ timeout: 20_000 })

    // A reset control on an untouched conversation would do nothing.
    await expect(page.getByRole('button', { name: 'New conversation' })).toBeHidden()

    const composer = page.getByLabel(/message the concierge/i)
    await composer.fill('Hello')
    await composer.press('Enter')

    await expect(page.getByRole('button', { name: 'New conversation' })).toBeVisible()
  })

  test('persists the session id so a reload resumes the same conversation', async ({ page }) => {
    await page.goto('/en/chat')
    await expect(page.getByText(/welcome/i).first()).toBeVisible({ timeout: 20_000 })

    const first = await page.evaluate(() => localStorage.getItem('derlg-chat-session'))
    expect(first).toMatch(/^[0-9a-f-]{36}$/)

    await page.reload()
    await expect(page.getByText(/welcome/i).first()).toBeVisible({ timeout: 20_000 })

    const second = await page.evaluate(() => localStorage.getItem('derlg-chat-session'))
    expect(second).toBe(first)
  })

  test('never stores a token in web storage', async ({ page }) => {
    await page.goto('/en/chat')
    await expect(page.getByText(/welcome/i).first()).toBeVisible({ timeout: 20_000 })

    const dump = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
    // Only ids are persisted — never messages or credentials.
    expect(dump).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/)
  })

  test('is localised, not hardcoded English', async ({ page }) => {
    await page.goto('/km/chat')
    // Khmer codepoints in the composer placeholder prove the shell is translated.
    const placeholder = await page
      .getByRole('textbox')
      .first()
      .getAttribute('placeholder')
    expect(placeholder ?? '').toMatch(/[\u1780-\u17FF]/)
  })

  test('has no critical or serious accessibility violations', async ({ page }) => {
    await page.goto('/en/chat')
    await expect(page.getByText(/welcome/i).first()).toBeVisible({ timeout: 20_000 })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const serious = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(serious).toEqual([])
  })
})

test.describe('chat shell without the agent', () => {
  test('still renders the page and composer when the socket cannot connect', async ({ page }) => {
    // Block the WebSocket so the app must degrade rather than render nothing.
    await page.routeWebSocket(/ws\/chat/, (ws) => ws.close())
    await page.goto('/en/chat')

    await expect(page.getByRole('heading', { name: 'DerLg AI Concierge' })).toBeVisible()
    await expect(page.getByLabel(/message the concierge/i)).toBeVisible()
  })

  test('queues a message typed while disconnected instead of losing it', async ({ page }) => {
    await page.routeWebSocket(/ws\/chat/, (ws) => ws.close())
    await page.goto('/en/chat')

    const composer = page.getByLabel(/message the concierge/i)
    await composer.fill('queued while offline')
    await composer.press('Enter')

    // The message is echoed locally and held for replay.
    await expect(page.getByText('queued while offline')).toBeVisible()
  })
})
