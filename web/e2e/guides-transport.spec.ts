import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('guides', () => {
  test.beforeEach(async ({ request }) => {
    const probe = await request.get('http://localhost:3003/v1/guides?limit=1').catch(() => null)
    test.skip(!probe?.ok(), 'backend on :3003 is not reachable')
  })

  test('lists guides using the province as the heading, since the API has no name', async ({
    page,
  }) => {
    await page.goto('/en/guides')

    const first = page.getByRole('article').first()
    await expect(first).toBeVisible()

    // The heading must never be empty even though no name field exists.
    const heading = await first.getByRole('heading').textContent()
    expect(heading?.trim()).toBeTruthy()
  })

  test('the language filter is reflected in the URL', async ({ page, isMobile }) => {
    await page.goto('/en/guides')
    await expect(page.getByRole('article').first()).toBeVisible()

    if (isMobile) await page.getByRole('button', { name: /Filters/ }).click()

    await page.getByLabel('Language spoken').selectOption('zh')
    await expect(page).toHaveURL(/language=zh/)
  })

  test('a guide card links to its detail route', async ({ page }) => {
    await page.goto('/en/guides')
    await expect(page.getByRole('article').first().getByRole('link').first()).toHaveAttribute(
      'href',
      /\/en\/guides\/[0-9a-f-]{36}$/,
    )
  })

  test('detail shows the bio, specialities and an availability check', async ({ page }) => {
    await page.goto('/en/guides')
    await page.getByRole('article').first().getByRole('link').first().click()

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Specialities' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Check availability' })).toBeVisible()
  })

  test('the availability check reports a verdict for a valid window', async ({ page }) => {
    await page.goto('/en/guides')
    await page.getByRole('article').first().getByRole('link').first().click()
    await expect(page.getByRole('heading', { name: 'Check availability' })).toBeVisible()

    // Empty busyRanges means free; the UI must state one or the other.
    await expect(page.getByText(/^(Available|Not available)$/)).toBeVisible({ timeout: 15_000 })
  })

  test('an invalid window is rejected before a request is made', async ({ page }) => {
    await page.goto('/en/guides')
    await page.getByRole('article').first().getByRole('link').first().click()
    await expect(page.getByRole('heading', { name: 'Check availability' })).toBeVisible()

    const from = await page.getByLabel('From').inputValue()
    await page.getByLabel('To').fill(from)

    await expect(page.getByLabel('To')).toHaveAttribute('aria-invalid', 'true')
  })

  test('an unknown guide id returns a 404', async ({ page }) => {
    const response = await page.goto('/en/guides/00000000-0000-0000-0000-000000000000')
    expect(response?.status()).toBe(404)
  })
})

test.describe('transport', () => {
  test.beforeEach(async ({ request }) => {
    const probe = await request
      .get('http://localhost:3003/v1/transportation/vehicles?limit=1')
      .catch(() => null)
    test.skip(!probe?.ok(), 'backend on :3003 is not reachable')
  })

  test('lists vehicles with capacity and pricing model', async ({ page }) => {
    await page.goto('/en/transport')

    const first = page.getByRole('article').first()
    await expect(first).toBeVisible()
    await expect(first).toContainText(/seats/i)
  })

  test('the type filter uses the parameter the backend accepts', async ({ page, isMobile }) => {
    await page.goto('/en/transport')
    await expect(page.getByRole('article').first()).toBeVisible()

    if (isMobile) await page.getByRole('button', { name: /Filters/ }).click()

    await page.getByLabel('Vehicle type').selectOption('bus')
    // The DTO names this `type`; `vehicleType` would return a 400.
    await expect(page).toHaveURL(/[?&]type=bus/)

    // A 400 would render the error state instead of results.
    await expect(page.getByRole('article').first()).toBeVisible()
  })

  test('detail shows capacity and an availability check', async ({ page }) => {
    await page.goto('/en/transport')
    await page.getByRole('article').first().getByRole('link').first().click()

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Capacity' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Check availability' })).toBeVisible()
  })

  test('an unknown vehicle id returns a 404', async ({ page }) => {
    const response = await page.goto('/en/transport/00000000-0000-0000-0000-000000000000')
    expect(response?.status()).toBe(404)
  })

  test('has no critical or serious accessibility violations', async ({ page }) => {
    await page.goto('/en/transport')
    await expect(page.getByRole('article').first()).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
