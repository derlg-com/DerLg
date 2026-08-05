import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility audit on the user-facing surfaces.
 *
 * Runs @axe-core/playwright against the public pages and (with a signed-in
 * session) the editor, the concierge and checkout. Axe checks WCAG 2.2 AA by
 * default; any violation of the `critical`/`serious` impact levels fails the
 * test so a regression is caught before it ships.
 *
 * Authenticated pages need a session cookie. Rather than drive the register
 * flow in every audit (slow and noisy), we sign in once and reuse the
 * storageState for the editor / vibe / checkout audits.
 */

const RUN = process.env.E2E_RUN_ID ?? Date.now().toString();
const AUTH_FILE = `tests/e2e/.auth/${RUN}.json`;

/**
 * A future booking date unique enough that repeated runs and the parallel
 * booking specs don't collide on the same scarce inventory (a hold lives 15
 * minutes). This spec uses a different offset than manual-booking so the two
 * holds in one invocation land on different days.
 */
function bookingStartDate(offsetDays: number): string {
  const seed = Number.parseInt(RUN, 10);
  const base = Number.isFinite(seed) ? seed : Date.now();
  const dayOffset = (Math.floor(base / 1000) + offsetDays) % 1095;
  const d = new Date(Date.UTC(2028, 0, 1));
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

test.describe.configure({ mode: 'serial' });

test('audit: public pages (home, packages, package detail)', async ({ page }) => {
  for (const path of ['/', '/packages']) {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    assertNoSeriousViolations(results, path);
  }

  // A package detail page exists once seeded; open the first one.
  await page.goto('/packages');
  const firstDetail = page.getByRole('link', { name: 'View details' }).first();
  await firstDetail.click();
  await expect(page).toHaveURL(/\/packages\/[^/]+$/);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  assertNoSeriousViolations(results, 'package detail');
});

test('audit: authenticated pages (editor, vibe, checkout)', async ({ browser }) => {
  // Sign in once and persist the session.
  const page = await browser.newPage();
  await page.goto('/register');
  await page.getByLabel('Full name').fill('E2e A11y');
  await page.getByLabel('Email').fill(`e2e-a11y-${RUN}@derlg.test`);
  await page.getByLabel('Password').fill('E2e-Password-12345');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('link', { name: 'Bookings' })).toBeVisible({ timeout: 20_000 });
  await page.context().storageState({ path: AUTH_FILE });
  await page.close();

  // axe-core requires the page to come from an explicit browser context
  // (browser.newPage() uses an implicit one it rejects), so create a context
  // with the persisted session and open the audit page from it.
  const authedContext = await browser.newContext({ storageState: AUTH_FILE });
  const authed = await authedContext.newPage();

  // Vibe concierge.
  await authed.goto('/vibe');
  let results = await new AxeBuilder({ page: authed })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  assertNoSeriousViolations(results, '/vibe');

  // Editor: open a package and start customizing.
  await authed.goto('/packages');
  await authed.getByRole('link', { name: 'View details' }).first().click();
  await authed.getByRole('link', { name: 'Customize my journey' }).click();
  await expect(authed).toHaveURL(/\/customize$/);
  await expect(authed.getByTestId('price-total')).toBeVisible({ timeout: 20_000 });
  results = await new AxeBuilder({ page: authed })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  assertNoSeriousViolations(results, 'editor');

  // Checkout: drive the manual flow as far as the payment form. The draft
  // needs a future start date or the hold is rejected; "Pay now" on the
  // booking detail page opens the Stripe checkout.
  await authed.locator('#draft-start-date').fill(bookingStartDate(7));
  await authed.waitForResponse(
    (response) =>
      /\/v1\/journey-drafts\//.test(response.url()) &&
      response.request().method() === 'PATCH' &&
      response.ok(),
    { timeout: 20_000 },
  );
  await authed.getByRole('link', { name: 'Continue to booking' }).click();
  await expect(authed.getByRole('heading', { name: 'Confirm and hold' })).toBeVisible({
    timeout: 20_000,
  });
  await authed.getByLabel('Name for the booking').fill('E2e A11y');
  await authed.getByLabel('Email for the confirmation').fill(`e2e-a11y-${RUN}@derlg.test`);
  await authed.getByRole('button', { name: 'Confirm and hold' }).click();
  await expect(authed).toHaveURL(/\/bookings\//, { timeout: 20_000 });
  await authed.getByRole('link', { name: 'Pay now' }).click();
  await expect(authed).toHaveURL(/\/checkout\//, { timeout: 20_000 });
  // The checkout renders the Stripe payment form (pay-button) when test keys
  // are configured, or an explicit "not configured" notice when they aren't.
  const paymentSurface = authed
    .getByTestId('pay-button')
    .or(authed.getByText('Card payments are not set up on this environment yet.'));
  await expect(paymentSurface).toBeVisible({ timeout: 20_000 });
  results = await new AxeBuilder({ page: authed })
    // The Stripe Elements card form lives in a cross-origin iframe axe cannot
    //traverse; exclude it so the audit targets DerLg's own markup.
    .exclude('iframe[name*="stripe"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  assertNoSeriousViolations(results, 'checkout');
  await authedContext.close();
});

function assertNoSeriousViolations(
  results: Awaited<ReturnType<AxeBuilder['analyze']>>,
  label: string,
): void {
  const failing = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  if (failing.length > 0) {
    const summary = failing
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`)
      .join('\n  ');
    throw new Error(`Axe found serious/critical violations on ${label}:\n  ${summary}`);
  }
  expect(failing.length).toBe(0);
}