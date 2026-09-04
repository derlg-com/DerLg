import { expect, test } from '@playwright/test'

/**
 * Data-layer tests against the live backend on :3003.
 *
 * Skipped automatically when the backend is not running, so the suite stays
 * green in environments without the full stack.
 */
test.describe('trips data layer', () => {
  test.beforeEach(async ({ request }) => {
    const probe = await request.get('http://localhost:3003/v1/trips?limit=1').catch(() => null)
    test.skip(!probe?.ok(), 'backend on :3003 is not reachable')
  })

  test('renders real trips fetched from the backend', async ({ page }) => {
    await page.goto('/en/trips')

    const cards = page.getByRole('article')
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeGreaterThan(0)

    // A price must render, proving the envelope was unwrapped and parsed.
    await expect(page.getByText(/\$\d/).first()).toBeVisible()
  })

  test('shows a localised result count', async ({ page }) => {
    await page.goto('/en/trips')
    await expect(page.getByText(/\d+ trips?/)).toBeVisible()
  })

  test('serves Khmer content for the km locale', async ({ page }) => {
    await page.goto('/km/trips')
    await expect(page.getByRole('article').first()).toBeVisible()

    // Trip names come back translated from the backend via Accept-Language.
    const headings = await page.getByRole('article').getByRole('heading').allTextContents()
    expect(headings.join(' ')).toMatch(/[\u1780-\u17ff]/)
  })

  test('serves Chinese content for the zh locale', async ({ page }) => {
    await page.goto('/zh/trips')
    await expect(page.getByRole('article').first()).toBeVisible()

    const headings = await page.getByRole('article').getByRole('heading').allTextContents()
    expect(headings.join(' ')).toMatch(/[\u4e00-\u9fff]/)
  })

  test('a trip card links into the trip detail route', async ({ page }) => {
    await page.goto('/en/trips')
    const firstLink = page.getByRole('article').first().getByRole('link').first()
    await expect(firstLink).toHaveAttribute('href', /\/en\/trips\/[0-9a-f-]{36}$/)
  })
})

test.describe('trips error handling', () => {
  test('shows a retryable error state when the API fails', async ({ page }) => {
    // Fail the backend call so the error path is exercised deterministically.
    await page.route('**/v1/trips*', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Down' },
        }),
      }),
    )

    await page.goto('/en/trips')

    // Next.js renders its route announcer with role="alert" too, so exclude it.
    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(/Couldn't load trips|Retry/i)
    // The raw backend message must never surface to the user.
    await expect(alert).not.toContainText('Down')
  })

  test('shows an empty state when the API returns no trips', async ({ page }) => {
    await page.route('**/v1/trips*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { items: [], total: 0, page: 1, limit: 12, totalPages: 0 },
        }),
      }),
    )

    await page.goto('/en/trips')
    await expect(page.getByText('No trips found')).toBeVisible()
  })
})
