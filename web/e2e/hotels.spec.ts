import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('hotels browse', () => {
  test.beforeEach(async ({ request }) => {
    const probe = await request.get('http://localhost:3003/v1/hotels?limit=1').catch(() => null)
    test.skip(!probe?.ok(), 'backend on :3003 is not reachable')
  })

  test('renders hotels from the live API', async ({ page }) => {
    await page.goto('/en/hotels')
    await expect(page.getByRole('article').first()).toBeVisible()
    // Hotels use `coverImage`; a rendered image proves the right field was read.
    await expect(page.getByRole('article').first().locator('img').first()).toBeVisible()
  })

  test('the star filter is reflected in the URL', async ({ page, isMobile }) => {
    await page.goto('/en/hotels')
    await expect(page.getByRole('article').first()).toBeVisible()

    if (isMobile) await page.getByRole('button', { name: /Filters/ }).click()

    await page.getByLabel('Star rating').selectOption('4')
    await expect(page).toHaveURL(/starRating=4/)
  })

  test('a hotel card links to its detail route', async ({ page }) => {
    await page.goto('/en/hotels')
    await expect(page.getByRole('article').first().getByRole('link').first()).toHaveAttribute(
      'href',
      /\/en\/hotels\/[0-9a-f-]{36}$/,
    )
  })
})

test.describe('hotel detail', () => {
  test.beforeEach(async ({ request }) => {
    const probe = await request.get('http://localhost:3003/v1/hotels?limit=1').catch(() => null)
    test.skip(!probe?.ok(), 'backend on :3003 is not reachable')
  })

  async function openFirstHotel(page: import('@playwright/test').Page) {
    await page.goto('/en/hotels')
    await page.getByRole('article').first().getByRole('link').first().click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }

  test('shows amenities and the overview', async ({ page }) => {
    await openFirstHotel(page)
    await expect(page.getByRole('heading', { name: 'Amenities' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  })

  test('loads real rooms for the default date range', async ({ page }) => {
    await openFirstHotel(page)

    const rooms = page.getByRole('heading', { name: 'Rooms' })
    await expect(rooms).toBeVisible()

    // Rooms come from GET /hotels/:id/rooms?checkIn&checkOut with real prices.
    await expect(page.getByRole('button', { name: 'Select' }).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('selecting a room reveals a booking CTA carrying the dates', async ({ page }) => {
    await openFirstHotel(page)

    const select = page.getByRole('button', { name: 'Select' }).first()
    await expect(select).toBeVisible({ timeout: 15_000 })
    await select.click()

    const cta = page.getByRole('link', { name: 'Book now' })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute(
      'href',
      /\/booking\/new\?type=hotel&id=[0-9a-f-]+&roomId=[0-9a-f-]+&checkIn=\d{4}-\d{2}-\d{2}&checkOut=\d{4}-\d{2}-\d{2}/,
    )
  })

  test('the selected room is announced via aria-pressed', async ({ page }) => {
    await openFirstHotel(page)

    const select = page.getByRole('button', { name: 'Select' }).first()
    await expect(select).toBeVisible({ timeout: 15_000 })
    await select.click()

    await expect(page.getByRole('button', { name: 'Selected' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('an invalid date range is rejected before a request is made', async ({ page }) => {
    await openFirstHotel(page)
    await expect(page.getByRole('button', { name: 'Select' }).first()).toBeVisible({
      timeout: 15_000,
    })

    // Set checkout before check-in: the backend would 400, so the UI must not ask.
    const checkIn = await page.getByLabel('Check in').inputValue()
    await page.getByLabel('Check out').fill(checkIn)

    // The guidance is attached to the field it concerns, not repeated as body text.
    const checkOut = page.getByLabel('Check out')
    await expect(checkOut).toHaveAttribute('aria-invalid', 'true')
    await expect(checkOut).toHaveAccessibleDescription(
      'Pick your dates to see availability and prices.',
    )
    // No room list is requested while the range is invalid.
    await expect(page.getByRole('button', { name: 'Select' })).toHaveCount(0)
  })

  test('emits Hotel and BreadcrumbList structured data', async ({ page, request }) => {
    const list = await request.get('http://localhost:3003/v1/hotels?limit=1')
    const body = (await list.json()) as { data: { items: { id: string }[] } }
    await page.goto(`/en/hotels/${body.data.items[0]!.id}`)

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    const types = blocks.map((block) => (JSON.parse(block) as { '@type': string })['@type'])
    expect(types).toContain('Hotel')
    expect(types).toContain('BreadcrumbList')
  })

  test('an unknown hotel id returns a 404', async ({ page }) => {
    const response = await page.goto('/en/hotels/00000000-0000-0000-0000-000000000000')
    expect(response?.status()).toBe(404)
  })

  test('has no critical or serious accessibility violations', async ({ page }) => {
    await openFirstHotel(page)
    await expect(page.getByRole('button', { name: 'Select' }).first()).toBeVisible({
      timeout: 15_000,
    })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
