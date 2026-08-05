import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/** Unique address per run so registration never collides. */
function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@derlg.test`
}

const PASSWORD = 'e2e-password-1234'

test.describe('authentication', () => {
  test.beforeEach(async ({ request }) => {
    const probe = await request.get('http://localhost:3003/v1/trips?limit=1').catch(() => null)
    test.skip(!probe?.ok(), 'backend on :3003 is not reachable')
  })

  test('a guest sees a sign-in entry point', async ({ page }) => {
    await page.goto('/en')
    // On narrow viewports the auth slot lives in the header menu.
    const menuButton = page.getByRole('button', { name: 'Open menu' })
    if (await menuButton.isVisible().catch(() => false)) await menuButton.click()

    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible()
  })

  test('registering signs the user in and returns them home', async ({ page }) => {
    await page.goto('/en/register')

    await page.locator('input[name="email"]').fill(uniqueEmail())
    await page.locator('input[name="password"]').fill(PASSWORD)
    await page.locator('input[name="confirmPassword"]').fill(PASSWORD)
    await page.locator('input[name="name"]').fill('E2E Traveller')

    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).toHaveURL(/\/en$/, { timeout: 20_000 })
  })

  test('a mismatched confirmation is caught before submitting', async ({ page }) => {
    await page.goto('/en/register')

    await page.locator('input[name="email"]').fill(uniqueEmail())
    await page.locator('input[name="password"]').fill(PASSWORD)
    await page.locator('input[name="confirmPassword"]').fill('something-else')
    await page.getByRole('button', { name: 'Create account' }).click()

    // Still on the form; the confirm field is flagged.
    await expect(page).toHaveURL(/\/en\/register$/)
    await expect(page.locator('input[name="confirmPassword"]')).toHaveAttribute('aria-invalid', 'true')
  })

  test('a short password is rejected against the backend minimum', async ({ page }) => {
    await page.goto('/en/register')

    await page.locator('input[name="email"]').fill(uniqueEmail())
    await page.locator('input[name="password"]').fill('short')
    await page.locator('input[name="confirmPassword"]').fill('short')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).toHaveURL(/\/en\/register$/)
    await expect(page.locator('input[name="password"]')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  test('the session survives a full page reload', async ({ page }) => {
    const email = uniqueEmail()

    await page.goto('/en/register')
    await page.locator('input[name="email"]').fill(email)
    await page.locator('input[name="password"]').fill(PASSWORD)
    await page.locator('input[name="confirmPassword"]').fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/en$/, { timeout: 20_000 })

    // The access token is only in memory, so this proves the httpOnly refresh
    // cookie was exchanged for a new one on load. The email is asserted rather
    // than the name, since this registration deliberately omits the optional name.
    // Target the definition list entry: the avatar also carries the email in an
    // sr-only span, which is deliberately not visible.
    await page.goto('/en/profile')
    await expect(page.getByRole('definition').filter({ hasText: email })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('the access token is never written to browser storage', async ({ page }) => {
    await page.goto('/en/register')
    await page.locator('input[name="email"]').fill(uniqueEmail())
    await page.locator('input[name="password"]').fill(PASSWORD)
    await page.locator('input[name="confirmPassword"]').fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/en$/, { timeout: 20_000 })

    const stored = await page.evaluate(() =>
      JSON.stringify({
        local: Object.entries(localStorage),
        session: Object.entries(sessionStorage),
      }),
    )

    // A JWT is three base64url segments; none may appear in storage.
    expect(stored).not.toMatch(/eyJ[A-Za-z0-9_-]+\.eyJ/)
  })

  test('signing in with bad credentials shows a safe message', async ({ page }) => {
    await page.goto('/en/login')

    await page.locator('input[name="email"]').fill('nobody@derlg.test')
    await page.locator('input[name="password"]').fill('definitely-wrong')
    await page.getByRole('button', { name: 'Sign in' }).click()

    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)')
    await expect(alert).toBeVisible({ timeout: 20_000 })
    // The backend's own wording must not leak whether the account exists.
    await expect(alert).toContainText('Invalid email or password.')
  })

  test('a protected route redirects a guest to sign in and preserves the destination', async ({
    page,
  }) => {
    await page.goto('/en/profile')

    await expect(page).toHaveURL(/\/en\/login\?next=/, { timeout: 20_000 })
    expect(decodeURIComponent(page.url())).toContain('/profile')
  })

  test('signing out clears the session', async ({ page, isMobile }) => {
    await page.goto('/en/register')
    await page.locator('input[name="email"]').fill(uniqueEmail())
    await page.locator('input[name="password"]').fill(PASSWORD)
    await page.locator('input[name="confirmPassword"]').fill(PASSWORD)
    await page.locator('input[name="name"]').fill('Sign Out')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/en$/, { timeout: 20_000 })

    if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'Sign Out' }).first().click()
    await page.getByRole('button', { name: 'Log out' }).click()

    // Back to a guest: the protected route bounces again.
    await page.goto('/en/profile')
    await expect(page).toHaveURL(/\/en\/login\?next=/, { timeout: 20_000 })
  })

  test('the sign-in page has no critical or serious accessibility violations', async ({ page }) => {
    await page.goto('/en/login')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
