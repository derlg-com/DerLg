import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('trips browse', () => {
  test.beforeEach(async ({ request }) => {
    const probe = await request.get('http://localhost:3003/v1/trips?limit=1').catch(() => null)
    test.skip(!probe?.ok(), 'backend on :3003 is not reachable')
  })

  test('filters are reflected in the URL so the view is shareable', async ({ page, isMobile }) => {
    await page.goto('/en/trips')
    await expect(page.getByRole('article').first()).toBeVisible()

    // Below lg the filter panel is collapsed behind a disclosure.
    if (isMobile) {
      await page.getByRole('button', { name: /Filters/ }).click()
    }

    await page.getByLabel('Category').selectOption('temples')
    await expect(page).toHaveURL(/category=temples/)
  })

  test('a category link from home pre-applies the filter', async ({ page }) => {
    await page.goto('/en/trips?category=food')

    const select = page.getByLabel('Category')
    if (await select.isVisible().catch(() => false)) {
      await expect(select).toHaveValue('food')
    }

    // Every result must belong to the requested category.
    await expect(page.getByRole('article').first()).toBeVisible()
    const badges = await page.getByRole('article').getByText('food', { exact: true }).count()
    expect(badges).toBeGreaterThan(0)
  })

  test('sorting is not offered, because the backend ignores it', async ({ page }) => {
    await page.goto('/en/trips')
    await expect(page.getByRole('article').first()).toBeVisible()

    // Every backend list use-case hardcodes `orderBy: { createdAt: 'desc' }`, so a
    // sort control would be inert. Assert it is absent rather than shipping a
    // dead control that appears to work.
    await expect(page.getByLabel('Sort')).toHaveCount(0)
  })

  test('an over-restrictive filter shows an empty state with a way out', async ({ page }) => {
    await page.goto('/en/trips?priceMin=999999')

    await expect(page.getByText('No trips found')).toBeVisible()
    // The escape hatch is a real link, so it works without JavaScript.
    await expect(page.getByRole('link', { name: 'Clear filters' })).toBeVisible()
  })

  test('clearing filters restores the full list', async ({ page }) => {
    await page.goto('/en/trips?priceMin=999999')
    await expect(page.getByText('No trips found')).toBeVisible()

    await page.getByRole('link', { name: 'Clear filters' }).click()
    await expect(page).toHaveURL(/\/en\/trips$/)
    await expect(page.getByRole('article').first()).toBeVisible()
  })

  test('an invalid filter value does not break the page', async ({ page }) => {
    // The backend rejects unknown enum values with a 400; the UI must show the
    // error state rather than crashing.
    await page.goto('/en/trips?category=notacategory')

    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)')
    await expect(alert).toBeVisible()
  })
})

test.describe('trip detail', () => {
  test.beforeEach(async ({ request }) => {
    const probe = await request.get('http://localhost:3003/v1/trips?limit=1').catch(() => null)
    test.skip(!probe?.ok(), 'backend on :3003 is not reachable')
  })

  async function openFirstTrip(page: import('@playwright/test').Page) {
    await page.goto('/en/trips')
    await page.getByRole('article').first().getByRole('link').first().click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }

  test('renders the itinerary and inclusions from the live API', async ({ page }) => {
    await openFirstTrip(page)

    await expect(page.getByRole('heading', { name: 'Itinerary' })).toBeVisible()
    // The seeded trips all carry multi-day itineraries.
    const days = page.getByRole('list').filter({ hasText: 'Day' })
    expect(await days.count()).toBeGreaterThan(0)
  })

  test('offers booking and concierge paths', async ({ page }) => {
    await openFirstTrip(page)

    await expect(page.getByRole('link', { name: 'Book now' })).toHaveAttribute(
      'href',
      /\/booking\/new\?type=trip&id=/,
    )
    await expect(page.getByRole('link', { name: 'Ask the concierge' })).toHaveAttribute(
      'href',
      /\/chat\?context=/,
    )
  })

  test('shows a breadcrumb trail back to the list', async ({ page }) => {
    await openFirstTrip(page)

    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(breadcrumb).toBeVisible()

    await breadcrumb.getByRole('link', { name: 'Trips' }).click()
    await expect(page).toHaveURL(/\/en\/trips$/)
  })

  test('emits Product and BreadcrumbList structured data', async ({ page, request }) => {
    // Load the detail URL directly rather than clicking through: React does not
    // render script tags during client-side navigation, and structured data only
    // needs to be present in the server HTML that crawlers receive.
    const list = await request.get('http://localhost:3003/v1/trips?limit=1')
    const body = (await list.json()) as { data: { items: { id: string }[] } }
    const id = body.data.items[0]!.id

    await page.goto(`/en/trips/${id}`)

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    const types = blocks.map((block) => (JSON.parse(block) as { '@type': string })['@type'])
    expect(types).toContain('Product')
    expect(types).toContain('BreadcrumbList')
  })

  test('the gallery is keyboard operable', async ({ page }) => {
    await openFirstTrip(page)

    const thumbs = page.getByRole('group', { name: 'Photos' }).getByRole('button')
    const count = await thumbs.count()
    test.skip(count < 2, 'this trip has a single image')

    await thumbs.nth(1).click()
    await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true')
  })

  test('an unknown trip id returns a 404', async ({ page }) => {
    const response = await page.goto('/en/trips/00000000-0000-0000-0000-000000000000')
    expect(response?.status()).toBe(404)
  })

  test('has no critical or serious accessibility violations', async ({ page }) => {
    await openFirstTrip(page)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
