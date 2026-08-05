import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('home / discovery', () => {
  test.beforeEach(async ({ request }) => {
    const probe = await request.get('http://localhost:3003/v1/trips?limit=1').catch(() => null)
    test.skip(!probe?.ok(), 'backend on :3003 is not reachable')
  })

  test('renders the hero with a single h1', async ({ page }) => {
    await page.goto('/en')

    const headings = page.getByRole('heading', { level: 1 })
    await expect(headings).toHaveCount(1)
    await expect(headings).toContainText('Cambodia Travel')
  })

  test('renders category tiles linking to filtered trip lists', async ({ page }) => {
    await page.goto('/en')

    // Exact match: card category badges also contain the word "temples".
    const temples = page.getByRole('link', { name: 'Temples', exact: true })
    await expect(temples).toBeVisible()
    await expect(temples).toHaveAttribute('href', '/en/trips?category=temples')
  })

  test('server-renders catalogue content into the initial HTML for crawlers', async ({
    request,
  }) => {
    // Fetch without executing JavaScript: the shelves must already be present.
    const response = await request.get('/en')
    expect(response.ok()).toBe(true)

    const html = await response.text()
    expect(html).toContain('Popular trips')
    // A trip name from the seeded catalogue, proving data was fetched server-side.
    expect(html).toMatch(/Angkor|Beach|Culinary|Highlights|Adventure/)
  })

  test('emits Organization and WebSite structured data', async ({ page }) => {
    await page.goto('/en')

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(blocks.length).toBeGreaterThanOrEqual(2)

    const parsed = blocks.map((block) => JSON.parse(block) as { '@type': string })
    const types = parsed.map((entry) => entry['@type'])
    expect(types).toContain('Organization')
    expect(types).toContain('WebSite')
  })

  test('shows the trips shelf with live data and a see-all link', async ({ page }) => {
    await page.goto('/en')

    const shelf = page.locator('section', { has: page.getByRole('heading', { name: 'Popular trips' }) })
    await expect(shelf.getByRole('article').first()).toBeVisible()
    await expect(shelf.getByRole('link', { name: 'See all' })).toHaveAttribute(
      'href',
      '/en/trips',
    )
  })

  test('trip cards link to their detail route', async ({ page }) => {
    await page.goto('/en')

    const firstCard = page.getByRole('article').first()
    await expect(firstCard.getByRole('link').first()).toHaveAttribute(
      'href',
      /\/en\/trips\/[0-9a-f-]{36}$/,
    )
  })

  test('hero search navigates to the search page', async ({ page }) => {
    await page.goto('/en')

    await page.getByRole('search').getByRole('textbox').fill('angkor')
    await page.getByRole('search').getByRole('button', { name: 'Search' }).click()

    await expect(page).toHaveURL(/\/en\/search\?q=angkor$/)
    await expect(page.getByRole('article').first()).toBeVisible({ timeout: 15_000 })
  })

  test('hero search ignores a term the backend would reject', async ({ page }) => {
    await page.goto('/en')

    await page.getByRole('search').getByRole('textbox').fill('a')
    await page.getByRole('search').getByRole('button', { name: 'Search' }).click()

    // Under two characters the backend returns SRCH_QUERY_TOO_SHORT, so the form
    // must not navigate at all.
    await expect(page).toHaveURL(/\/en$/)
  })

  test('renders localised copy and content for Khmer', async ({ page }) => {
    await page.goto('/km')

    const heading = await page.getByRole('heading', { level: 1 }).textContent()
    expect(heading).toMatch(/[\u1780-\u17ff]/)

    const cardText = await page.getByRole('article').first().textContent()
    expect(cardText).toMatch(/[\u1780-\u17ff]/)
  })

  test('has no critical or serious accessibility violations', async ({ page }) => {
    await page.goto('/en')
    await expect(page.getByRole('article').first()).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })

  test('reserves image space so the layout does not shift', async ({ page }) => {
    await page.goto('/en')
    const media = page.getByRole('article').first().locator('div').first()

    const box = await media.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThan(0)
    expect(box?.width ?? 0).toBeGreaterThan(0)
  })
})
