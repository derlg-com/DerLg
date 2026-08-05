import { expect, test } from '@playwright/test'

test('home page renders the scaffold shell', async ({ page }) => {
  await page.goto('/en')

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cambodia Travel')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
})

test('home page has no console errors on load', async ({ page }) => {
  const errors: string[] = []
  const unauthorizedUrls: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('response', (response) => {
    if (response.status() === 401) unauthorizedUrls.push(response.url())
  })

  await page.goto('/en')
  await page.waitForLoadState('networkidle')

  /*
   * The session bootstrap probes POST /v1/auth/refresh on every load. For a guest
   * with no refresh cookie a 401 is the CORRECT response, and Chrome logs every 401
   * as "Failed to load resource" whether or not the app handles it. The cookie is
   * httpOnly, so the client cannot check for it first — the probe is unavoidable.
   *
   * So that one expected 401 is tolerated, but only after asserting it really came
   * from the auth probe. Any other console error still fails.
   */
  const expectedProbe = /Failed to load resource.*401/i
  const tolerated = errors.filter((error) => expectedProbe.test(error))
  const unexpected = errors.filter((error) => !expectedProbe.test(error))

  if (tolerated.length > 0) {
    expect(unauthorizedUrls.every((url) => url.includes('/v1/auth/refresh'))).toBe(true)
  }

  expect(unexpected).toEqual([])
})
