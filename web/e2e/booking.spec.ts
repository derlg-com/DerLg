import { expect, test, type Page } from '@playwright/test'

/**
 * Booking and checkout flow against the LIVE backend.
 *
 * These create real bookings through the UI, so each test registers its own account
 * — sharing one would let a failure in an earlier test corrupt a later one, and the
 * bookings list is per-user.
 */

const API = 'http://localhost:3003'

async function backendUp(request: import('@playwright/test').APIRequestContext) {
  const probe = await request.get(`${API}/v1/trips`).catch(() => null)
  return Boolean(probe?.ok())
}

/** Registers a fresh account through the UI so the session is real. */
async function signUp(page: Page): Promise<string> {
  const email = `bkflow-${Date.now()}-${Math.floor(Math.random() * 10_000)}@derlg.test`

  await page.goto('/en/register')
  await page.getByLabel(/email/i).fill(email)
  await page.locator('input[name="password"]').fill('Passw0rd!23')
  await page.locator('input[name="confirmPassword"]').fill('Passw0rd!23')
  await page.getByRole('button', { name: /create account|sign up/i }).click()

  // The header switching to the account menu is the signal the session is live.
  await expect(page.getByRole('link', { name: /^sign in$/i })).toHaveCount(0, { timeout: 20_000 })
  return email
}

/** Picks the first seeded trip's id from the API. */
async function firstTripId(request: import('@playwright/test').APIRequestContext) {
  const response = await request.get(`${API}/v1/trips?limit=1`)
  const body = (await response.json()) as { data: { items: { id: string }[] } }
  return body.data.items[0]!.id
}

test.describe('booking form', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await backendUp(request)), 'backend on :3003 is not reachable')
  })

  test('asks a guest to sign in and returns them to the same booking', async ({
    page,
    request,
  }) => {
    const tripId = await firstTripId(request)
    await page.goto(`/en/booking/new?type=trip&id=${tripId}`)

    await expect(page.getByRole('heading', { name: /sign in to book/i })).toBeVisible({
      timeout: 20_000,
    })

    // The destination is preserved so the intent is not lost.
    const signIn = page.getByRole('link', { name: /sign in to book/i })
    const href = await signIn.getAttribute('href')
    expect(href).toContain('/login?next=')
    expect(decodeURIComponent(href ?? '')).toContain(`/booking/new`)
  })

  test('404s without a resource to book', async ({ page }) => {
    const response = await page.goto('/en/booking/new')
    expect(response?.status()).toBe(404)
  })

  test('404s for a resource that does not exist', async ({ page }) => {
    const response = await page.goto(
      '/en/booking/new?type=trip&id=00000000-0000-4000-8000-000000000000',
    )
    expect(response?.status()).toBe(404)
  })

  test('shows the trip name and an estimate that counts children', async ({ page, request }) => {
    await signUp(page)
    const tripId = await firstTripId(request)
    await page.goto(`/en/booking/new?type=trip&id=${tripId}`)

    await expect(page.getByRole('button', { name: /confirm & continue/i })).toBeVisible({
      timeout: 20_000,
    })

    const summary = page.getByRole('region', { name: /price summary/i })
    const before = (await summary.innerText()).replace(/\s+/g, ' ')

    // Children pay the full per-person price, so the total must rise.
    await page.locator('input[name="children"]').fill('2')
    await expect
      .poll(async () => (await summary.innerText()).replace(/\s+/g, ' ') !== before, {
        timeout: 5_000,
      })
      .toBe(true)

    await expect(summary.getByText(/children are charged/i)).toBeVisible()
  })

  test('requires a room before a hotel can be booked', async ({ page, request }) => {
    await signUp(page)
    const response = await request.get(`${API}/v1/hotels?limit=1`)
    const body = (await response.json()) as { data: { items: { id: string }[] } }
    const hotelId = body.data.items[0]!.id

    await page.goto(`/en/booking/new?type=hotel&id=${hotelId}`)

    // A hotel booking needs a specific room, which is chosen on the hotel page.
    await expect(page.getByRole('heading', { name: /select a room/i })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('link', { name: /back to hotel/i })).toHaveAttribute(
      'href',
      `/en/hotels/${hotelId}`,
    )
  })

  test('creates a real hold and lands on checkout', async ({ page, request }) => {
    await signUp(page)
    const tripId = await firstTripId(request)
    await page.goto(`/en/booking/new?type=trip&id=${tripId}`)

    const submit = page.getByRole('button', { name: /confirm & continue/i })
    await expect(submit).toBeVisible({ timeout: 20_000 })
    await submit.click()

    // Straight to checkout, with a live hold.
    await expect(page).toHaveURL(/\/en\/bookings\/[0-9a-f-]{36}/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: /review your booking/i })).toBeVisible()
  })
})

test.describe('checkout', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await backendUp(request)), 'backend on :3003 is not reachable')
  })

  /** Signs up and books a trip, returning the checkout URL. */
  async function bookTrip(page: Page, request: import('@playwright/test').APIRequestContext) {
    await signUp(page)
    const tripId = await firstTripId(request)
    await page.goto(`/en/booking/new?type=trip&id=${tripId}`)

    const submit = page.getByRole('button', { name: /confirm & continue/i })
    await expect(submit).toBeVisible({ timeout: 20_000 })
    await submit.click()
    await expect(page).toHaveURL(/\/en\/bookings\/[0-9a-f-]{36}/, { timeout: 30_000 })
  }

  test('counts down the 15-minute hold', async ({ page, request }) => {
    await bookTrip(page, request)

    // Freshly created, so it should read close to 15 minutes.
    await expect(page.getByText(/1[345]m \d+s/)).toBeVisible({ timeout: 15_000 })
  })

  test('shows the reference, total and a demo-mode notice before paying', async ({
    page,
    request,
  }) => {
    await bookTrip(page, request)

    await expect(page.getByText(/TRP-[A-Z0-9]+/)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/\$1,?197|\$399/)).toBeVisible()

    // Stated before the pay button, not after.
    await expect(page.getByText(/demo mode/i)).toBeVisible()
  })

  test('offers all three payment methods as real radio inputs', async ({ page, request }) => {
    await bookTrip(page, request)

    const group = page.getByRole('group', { name: /payment method/i })
    await expect(group.getByRole('radio')).toHaveCount(3)
    // Card is preselected so the primary action is always reachable.
    await expect(group.getByRole('radio', { name: /credit \/ debit card/i })).toBeChecked()
  })

  test('confirms the sandbox payment and issues a ticket QR', async ({ page, request }) => {
    await bookTrip(page, request)

    await page.getByRole('button', { name: /pay now/i }).click()

    // DEMO_PAYMENTS is enabled on this server, so confirmation succeeds.
    await expect(page.getByRole('status')).toContainText(/booking confirmed/i, { timeout: 30_000 })

    // The real ticket QR is minted by the backend on confirmation.
    const qr = page.getByRole('region', { name: /check-in qr/i }).getByRole('img')
    await expect(qr).toBeVisible()
    expect(await qr.getAttribute('src')).toContain('DERLG-TICKET')
  })

  test('replaces the payment form once the booking is settled', async ({ page, request }) => {
    await bookTrip(page, request)
    const url = page.url()

    await page.getByRole('button', { name: /pay now/i }).click()
    await expect(page.getByRole('status')).toContainText(/booking confirmed/i, { timeout: 30_000 })

    // Revisiting must not offer payment again.
    await page.goto(url)
    await expect(page.getByRole('status')).toContainText(/booking confirmed/i, { timeout: 20_000 })
    await expect(page.getByRole('button', { name: /pay now/i })).toHaveCount(0)
  })

  test('has no critical or serious accessibility violations', async ({ page, request }) => {
    await bookTrip(page, request)

    const AxeBuilder = (await import('@axe-core/playwright')).default
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const serious = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(serious).toEqual([])
  })
})
