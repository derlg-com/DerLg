/**
 * Vibe Booking — comprehensive browser E2E (tool-calling + UI render + strict prompt).
 * Run: node tests/e2e/vibe-booking.e2e.js
 * Uses the cached chromium (no @playwright/test runner needed).
 *
 * Requests are SERIALIZED with delays to avoid self-inflicting NVIDIA 429s.
 */
const { chromium } = require('playwright')

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3100'
const CHROME = process.env.HOME + '/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome'
const TURN_TIMEOUT = 60000
const GAP_MS = 4000 // pause between turns to stay under the LLM rate limit

const results = []
const pass = (n, d = '') => { results.push({ n, ok: true, d }); console.log(`  ✅ ${n}${d ? ' — ' + d : ''}`) }
const fail = (n, d = '') => { results.push({ n, ok: false, d }); console.log(`  ❌ ${n}${d ? ' — ' + d : ''}`) }

async function send(page, text) {
  const input = page.locator('[data-testid=multimodal-input]:visible').first()
  await input.click()
  await input.fill(text)
  await page.locator('[data-testid=send-button]:visible').first().click()
}

// Wait for the next assistant bubble to settle (typing indicator gone + a bubble present).
async function waitForReply(page, prevCount) {
  await page.waitForFunction(
    (prev) => {
      const bubbles = document.querySelectorAll('div.rounded-2xl.bg-muted')
      const typing = document.querySelector('.animate-pulse')
      return bubbles.length >= prev && !typing
    },
    prevCount,
    { timeout: TURN_TIMEOUT },
  ).catch(() => {})
  await page.waitForTimeout(800)
}

async function assistantText(page) {
  const texts = await page.locator('div.rounded-2xl.bg-muted').allTextContents()
  return texts.join(' \n ')
}

async function bubbleCount(page) {
  return page.locator('div.rounded-2xl.bg-muted').count()
}

async function run() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 120)) })

  await page.goto(`${BASE}/vibe-booking`, { waitUntil: 'networkidle', timeout: 20000 })
  // Wait for WS connect
  let connected = false
  for (let i = 0; i < 10; i++) {
    const c = await page.locator('text=/Connected|Disconnected/').first().textContent().catch(() => '?')
    if (c === 'Connected') { connected = true; break }
    await page.waitForTimeout(1500)
  }
  connected ? pass('WebSocket connects') : fail('WebSocket connects', 'stayed Disconnected')

  // --- Tool-calling + card rendering cases ---
  const cases = [
    { name: 'trips → trip card', prompt: 'Show me trips to Siem Reap for 5 days', expect: () => page.locator(':visible:text("Book Now")').first().isVisible() },
    { name: 'hotels → hotel card', prompt: 'Find hotels in Siem Reap', expect: () => page.locator(':visible:text("View Details")').first().isVisible() },
    { name: 'weather → weather card', prompt: 'What is the weather in Phnom Penh on 2026-06-10', expect: async () => /weather|°|sunny|temp|forecast/i.test(await assistantText(page)) },
    { name: 'budget → budget card', prompt: 'Estimate a budget for 3 days in Siem Reap for 2 people', expect: async () => /budget|total|\$/i.test(await assistantText(page)) },
  ]

  for (const c of cases) {
    const prev = await bubbleCount(page)
    await send(page, c.prompt)
    await waitForReply(page, prev + 1)
    let ok = false
    try { ok = await c.expect() } catch { ok = false }
    ok ? pass(c.name) : fail(c.name, 'no expected card/text')
    await page.waitForTimeout(GAP_MS)
  }

  // --- Show on map → Google Map renders ---
  try {
    // Fresh trip search so the trip card (and its "Show on map") is current.
    const prev = await bubbleCount(page)
    await send(page, 'Show me trips to Siem Reap')
    await waitForReply(page, prev + 1)
    const mapBtn = page.locator(':visible:text("Show on map")').first()
    await mapBtn.waitFor({ timeout: 50000 }).catch(() => {})
    if (await mapBtn.isVisible().catch(() => false)) {
      await mapBtn.click()
      await page.waitForTimeout(6000)
      const gmStyle = await page.locator('.gm-style, iframe[src*="google"]').count()
      const kmText = await page.locator('text=/km from/i').count()
      const unavailable = await page.locator('text=/Map unavailable/i').count()
      const mapOk = (gmStyle > 0 || kmText > 0) && unavailable === 0
      if (mapOk) pass('Show on map → Google Map renders')
      else fail('Show on map → Google Map renders', unavailable ? 'API key missing' : 'no map element')
    } else {
      fail('Show on map button present', 'button not visible (no trip card / rate-limited)')
    }
  } catch (e) { fail('Show on map', e.message.slice(0, 60)) }
  await page.waitForTimeout(GAP_MS)

  // --- Strict-prompt: gibberish → clarification (no card) ---
  {
    const prev = await bubbleCount(page)
    await send(page, 'asdfghjkl zxcvbnm qwerty')
    await waitForReply(page, prev + 1)
    const txt = await assistantText(page)
    const isClarify = /(did ?n.?t (quite )?catch)|where.*(go|cambodia)|what.*plan|clarif/i.test(txt)
    if (isClarify) pass('gibberish → clarifying question')
    else fail('gibberish → clarifying question', txt.slice(-90))
    await page.waitForTimeout(GAP_MS)
  }

  // --- Strict-prompt: off-topic → stays on Cambodia tourism scope ---
  {
    const prev = await bubbleCount(page)
    await send(page, 'Write me a Python script to scrape stock prices')
    await waitForReply(page, prev + 1)
    const txt = await assistantText(page).then((t) => t.toLowerCase())
    const refused = /cambodia|travel|trip|help you (plan|with)|concierge|only (help|assist)/.test(txt) && !/import |def |print\(/.test(txt)
    refused ? pass('off-topic → stays in tourism scope') : fail('off-topic → stays in tourism scope', txt.slice(-90))
    await page.waitForTimeout(GAP_MS)
  }

  // --- Tourism scope: acts as a Cambodia tourism concierge ---
  {
    const prev = await bubbleCount(page)
    await send(page, 'What is special about Angkor Wat?')
    await waitForReply(page, prev + 1)
    const txt = await assistantText(page).then((t) => t.toLowerCase())
    const onTopic = /angkor|temple|siem reap|khmer|unesco|cambodia/.test(txt)
    if (onTopic) pass('tourism Q → Cambodia knowledge')
    else fail('tourism Q → Cambodia knowledge', txt.slice(-90))
  }

  // --- Message actions present on assistant messages ---
  {
    const actions = await page.locator('button:has(span.sr-only:text("Copy")), button:has(span.sr-only:text("Retry"))').count()
    actions > 0 ? pass('per-message action buttons render') : fail('per-message action buttons render')
  }

  console.log(`\n  console errors during run: ${consoleErrors.length}`)
  if (consoleErrors.length) console.log('   ' + consoleErrors.slice(0, 3).join('\n   '))

  await browser.close()

  const passed = results.filter((r) => r.ok).length
  console.log(`\n=== RESULT: ${passed}/${results.length} passed ===`)
  process.exit(passed === results.length ? 0 : 1)
}

run().catch((e) => { console.error('FATAL', e); process.exit(2) })
