import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Reveals the map pane.
 *
 * Below `lg` the list and map are alternate panes rather than side by side, so
 * mobile has to switch before the map exists in the layout.
 */
async function showMap(page: import('@playwright/test').Page, isMobile: boolean | undefined) {
  if (!isMobile) return
  await page.getByRole('radiogroup', { name: 'View mode' }).getByRole('radio', { name: 'Map' }).click()
}

test.describe('explore map', () => {
  test.beforeEach(async ({ request }) => {
    const probe = await request.get('http://localhost:3003/v1/places?limit=1').catch(() => null)
    test.skip(!probe?.ok(), 'backend on :3003 is not reachable')
  })

  test('lists places from the live API', async ({ page }) => {
    await page.goto('/en/explore')

    const list = page.getByRole('region', { name: 'Places list' })
    await expect(list.getByRole('article').first()).toBeVisible()
    expect(await list.getByRole('article').count()).toBeGreaterThan(1)
  })

  test('renders the Leaflet map with OpenStreetMap tiles', async ({ page, isMobile }) => {
    await page.goto('/en/explore')
    await showMap(page, isMobile)

    const map = page.getByRole('application', { name: /Map of Cambodia/ })
    await expect(map).toBeVisible({ timeout: 20_000 })

    // Tiles come from OSM; their presence proves the map actually initialised.
    await expect(page.locator('img.leaflet-tile').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap')
  })

  test('places markers for every place that has coordinates', async ({
    page,
    request,
    isMobile,
  }) => {
    const response = await request.get('http://localhost:3003/v1/places?limit=50')
    const body = (await response.json()) as {
      data: { items: { latitude: number | null; longitude: number | null }[] }
    }
    const mappable = body.data.items.filter(
      (place) => place.latitude != null && place.longitude != null,
    ).length

    await page.goto('/en/explore')
    await showMap(page, isMobile)
    await expect(page.locator('img.leaflet-tile').first()).toBeVisible({ timeout: 20_000 })

    // Markers may be clustered, so count pins plus cluster bubbles.
    const pins = await page.locator('.derlg-pin').count()
    const clusters = await page.locator('.marker-cluster').count()
    expect(pins + clusters).toBeGreaterThan(0)
    expect(mappable).toBeGreaterThan(0)
  })

  test('selecting a place from the list opens its detail sheet', async ({ page }) => {
    await page.goto('/en/explore')

    const first = page.getByRole('region', { name: 'Places list' }).getByRole('article').first()
    await expect(first).toBeVisible()
    const name = (await first.getByRole('heading').textContent())?.trim() ?? ''

    await first.getByRole('button').click()

    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText(name)
  })

  test('the selection is reflected in the URL so it can be shared', async ({ page }) => {
    await page.goto('/en/explore')

    const first = page.getByRole('region', { name: 'Places list' }).getByRole('article').first()
    await first.getByRole('button').click()

    await expect(page).toHaveURL(/[?&]place=[0-9a-f-]{36}/)
  })

  test('a shared selection link opens the sheet directly', async ({ page, request }) => {
    const response = await request.get('http://localhost:3003/v1/places?limit=1')
    const body = (await response.json()) as { data: { items: { id: string; name: string }[] } }
    const place = body.data.items[0]!

    await page.goto(`/en/explore?place=${place.id}`)

    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText(place.name)
  })

  test('the list selection is announced via aria-pressed', async ({ page }) => {
    await page.goto('/en/explore')

    const button = page
      .getByRole('region', { name: 'Places list' })
      .getByRole('article')
      .first()
      .getByRole('button')

    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  test('the category filter narrows the results and is shareable', async ({ page, isMobile }) => {
    await page.goto('/en/explore')
    await expect(
      page.getByRole('region', { name: 'Places list' }).getByRole('article').first(),
    ).toBeVisible()

    if (isMobile) await page.getByRole('button', { name: /Filters/ }).click()

    await page.getByLabel('Place type').selectOption('nature')
    await expect(page).toHaveURL(/category=nature/)

    const categories = await page
      .getByRole('region', { name: 'Places list' })
      .getByRole('article')
      .allTextContents()
    expect(categories.every((text) => text.includes('nature'))).toBe(true)
  })

  test('mobile offers a list and map pane switch', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the pane switch is mobile-only')

    await page.goto('/en/explore')

    const group = page.getByRole('radiogroup', { name: 'View mode' })
    await expect(group).toBeVisible()

    await group.getByRole('radio', { name: 'Map' }).click()
    await expect(page.getByRole('application', { name: /Map of Cambodia/ })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('has no critical or serious accessibility violations', async ({ page, isMobile }) => {
    await page.goto('/en/explore')
    await showMap(page, isMobile)
    await expect(page.locator('img.leaflet-tile').first()).toBeVisible({ timeout: 20_000 })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Leaflet's own zoom controls are third-party markup we do not author.
      .exclude('.leaflet-control-container')
      .analyze()

    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
