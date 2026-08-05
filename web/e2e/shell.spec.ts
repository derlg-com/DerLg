import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('app shell', () => {
  test('renders the shell landmarks on every page', async ({ page }) => {
    await page.goto('/en')

    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('contentinfo')).toBeVisible()
  })

  test('the skip link is the first focusable element and jumps to main', async ({ page }) => {
    await page.goto('/en')

    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('link', { name: 'Skip to content' })
    await expect(skipLink).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#main$/)
  })

  test('has no critical or serious accessibility violations', async ({ page }) => {
    await page.goto('/en')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })

  test('every navigation destination resolves without a 404', async ({ page }) => {
    const routes = [
      '/en',
      '/en/trips',
      '/en/hotels',
      '/en/guides',
      '/en/transport',
      '/en/explore',
      '/en/chat',
      '/en/bookings',
      '/en/profile',
      '/en/festivals',
      '/en/loyalty',
      '/en/safety',
      '/en/places',
    ]

    const broken: string[] = []
    for (const route of routes) {
      const response = await page.goto(route)
      const status = response?.status() ?? 0
      if (status !== 200) broken.push(`${route} → ${status}`)
    }

    expect(broken).toEqual([])
  })
})

test.describe('desktop navigation', () => {
  test.skip(({ isMobile }) => Boolean(isMobile), 'desktop-only navigation')

  test('marks the active section with aria-current', async ({ page }) => {
    await page.goto('/en/trips')

    const nav = page.getByRole('navigation', { name: 'Main navigation' }).first()
    await expect(nav.getByRole('link', { name: 'Trips' })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('link', { name: 'Hotels' })).not.toHaveAttribute('aria-current')
  })

  test('navigates between sections', async ({ page }) => {
    await page.goto('/en')

    const nav = page.getByRole('navigation', { name: 'Main navigation' }).first()
    await nav.getByRole('link', { name: 'Hotels' }).click()
    await expect(page).toHaveURL(/\/en\/hotels$/)
  })
})

test.describe('mobile bottom navigation', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile-only navigation')

  test('shows five destinations and marks the active one', async ({ page }) => {
    await page.goto('/en/explore')

    const nav = page.getByRole('navigation', { name: 'Primary sections' })
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('link')).toHaveCount(5)
    await expect(nav.getByRole('link', { name: 'Explore' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

test.describe('command palette', () => {
  test('opens with the keyboard shortcut and searches live data', async ({ page, request }) => {
    const probe = await request.get('http://localhost:3003/v1/trips?limit=1').catch(() => null)
    test.skip(!probe?.ok(), 'backend on :3003 is not reachable')

    await page.goto('/en')
    await page.keyboard.press('ControlOrMeta+k')

    const input = page.getByRole('combobox')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()

    await input.fill('angkor')

    const options = page.getByRole('option')
    await expect(options.first()).toBeVisible({ timeout: 15_000 })
    await expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  test('navigates to the selected result with the keyboard', async ({ page, request }) => {
    const probe = await request.get('http://localhost:3003/v1/trips?limit=1').catch(() => null)
    test.skip(!probe?.ok(), 'backend on :3003 is not reachable')

    await page.goto('/en')
    await page.keyboard.press('ControlOrMeta+k')

    const input = page.getByRole('combobox')
    await input.fill('angkor')
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15_000 })

    await page.keyboard.press('Enter')
    // Routes to a catalogue detail page for whichever kind matched first.
    await expect(page).toHaveURL(/\/en\/(trips|hotels|guides|places|transport)\/[^/]+$/)
  })

  test('closes on Escape', async ({ page }) => {
    await page.goto('/en')
    await page.keyboard.press('ControlOrMeta+k')
    await expect(page.getByRole('combobox')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('combobox')).toBeHidden()
  })

  test('opens from the header search button', async ({ page }) => {
    await page.goto('/en')

    await page.getByRole('banner').getByRole('button', { name: /Search/ }).click()
    await expect(page.getByRole('combobox')).toBeVisible()
  })
})
