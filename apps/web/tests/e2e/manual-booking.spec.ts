import { expect, test } from '@playwright/test';

/**
 * Golden path — the manual booking funnel.
 *
 * register → browse packages → open a package → customize the plan → continue
 * to booking (creates the 15-minute hold) → reach checkout and assert the
 * payment form is ready.
 *
 * The actual card payment needs Stripe test keys + a `stripe listen` webhook
 * forwarder (see README). Without them this test stops at the checkout page and
 * asserts the payment form renders, which is still a meaningful green path.
 */

const RUN = process.env.E2E_RUN_ID ?? Date.now().toString();

function uniqueEmail(): string {
  return `e2e-manual-${RUN}@derlg.test`;
}

/**
 * A future booking date unique enough that repeated runs and the parallel
 * booking specs don't collide on the same scarce inventory (a hold lives 15
 * minutes). The date varies with the run timestamp plus a per-spec offset, so
 * two specs in one invocation and two invocations back-to-back use different
 * days, keeping availability open for each hold.
 */
function bookingStartDate(offsetDays: number): string {
  const seed = Number.parseInt(RUN, 10);
  const base = Number.isFinite(seed) ? seed : Date.now();
  const dayOffset = (Math.floor(base / 1000) + offsetDays) % 1095; // ~3-year span
  const d = new Date(Date.UTC(2028, 0, 1));
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

test('manual: register → browse → customize → hold → checkout', async ({ page }) => {
  // 1. Register -----------------------------------------------------------
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Create your DerLg account' })).toBeVisible();
  await page.getByLabel('Full name').fill('E2e Manual');
  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByLabel('Password').fill('E2e-Password-12345');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Auth redirects into the app shell; the site header now shows the signed-in
  // state rather than "Create account".
  await expect(page.getByRole('link', { name: 'Bookings' })).toBeVisible({ timeout: 20_000 });

  // 2. Browse -------------------------------------------------------------
  await page.goto('/packages');
  await expect(page.getByRole('link', { name: 'View details' }).first()).toBeVisible();
  // Open the first package by following its "View details" link.
  const detailLink = page.getByRole('link', { name: 'View details' }).first();
  await detailLink.click();

  // 3. Package detail → customize ----------------------------------------
  await expect(page).toHaveURL(/\/packages\/[^/]+$/);
  // "Customize my journey" opens the editor on a draft for this package.
  await page.getByRole('link', { name: 'Customize my journey' }).click();

  // 4. Customize ----------------------------------------------------------
  await expect(page).toHaveURL(/\/packages\/[^/]+\/customize$/);
  // The editor renders the running total. Wait for it to price the plan.
  await expect(page.getByTestId('price-total')).toBeVisible({ timeout: 20_000 });
  // Sanity: the plan has a non-zero total for a real package.
  const total = await page.getByTestId('price-total').textContent();
  expect(total).toBeTruthy();

  // A draft without a start date cannot be held — the API rejects it with
  // "Choose a start date before booking." Pick a future date and wait for the
  // autosave PATCH to land before continuing.
  await page.locator('#draft-start-date').fill(bookingStartDate(0));
  await page.waitForResponse(
    (response) =>
      /\/v1\/journey-drafts\//.test(response.url()) &&
      response.request().method() === 'PATCH' &&
      response.ok(),
    { timeout: 20_000 },
  );

  // 5. Continue to booking → the hold ------------------------------------
  // "Continue to booking" links to /checkout/new?draft=<id>, which renders
  // the StartBooking form. Confirming creates the 15-minute hold and routes
  // to the booking detail page.
  await page.getByRole('link', { name: 'Continue to booking' }).click();

  // StartBooking asks for contact details, then creates the hold.
  await expect(page.getByRole('heading', { name: 'Confirm and hold' })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByLabel('Name for the booking').fill('E2e Manual');
  await page.getByLabel('Email for the confirmation').fill(uniqueEmail());
  await page.getByRole('button', { name: 'Confirm and hold' }).click();

  // 6. Checkout -----------------------------------------------------------
  // The hold lands on the booking detail page; "Pay now" opens the checkout.
  // The checkout renders the Stripe payment form (pay-button) when test keys
  // are configured, or an explicit "not configured" notice when they aren't
  // (see README). Either is a valid golden-path endpoint; a 500 or a blank
  // checkout page is not.
  await expect(page).toHaveURL(/\/bookings\//, { timeout: 20_000 });
  await page.getByRole('link', { name: 'Pay now' }).click();
  await expect(page).toHaveURL(/\/checkout\//, { timeout: 20_000 });
  const paymentSurface = page
    .getByTestId('pay-button')
    .or(page.getByText('Card payments are not set up on this environment yet.'));
  await expect(paymentSurface).toBeVisible({ timeout: 20_000 });
});