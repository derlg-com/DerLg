import { expect, test } from '@playwright/test';

/**
 * Golden path — the AI concierge funnel.
 *
 * register → /vibe → ask the concierge to compose a trip → wait for the plan
 * to appear → ask it to hold the booking → assert the hold renders with a
 * reference and a checkout link.
 *
 * Needs a working OPENAI_API_KEY (NVIDIA NIM) so the concierge can call its
 * tools. Without it the concierge answers 503 and this test is skipped.
 */

const RUN = process.env.E2E_RUN_ID ?? Date.now().toString();

function uniqueEmail(): string {
  return `e2e-ai-${RUN}@derlg.test`;
}

test('ai: register → /vibe → compose → hold', async ({ page }) => {
  // The concierge streams over SSE and the LLM (NVIDIA NIM) can take a while
  // per turn; the default 60s per-test cap is shorter than the compose + hold
  // waits below, so give this golden path room to finish on a slow provider.
  test.setTimeout(240_000);

  // 1. Register -----------------------------------------------------------
  await page.goto('/register');
  await page.getByLabel('Full name').fill('E2e Ai');
  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByLabel('Password').fill('E2e-Password-12345');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('link', { name: 'Bookings' })).toBeVisible({ timeout: 20_000 });

  // 2. Open the concierge -------------------------------------------------
  await page.goto('/vibe');
  await expect(page.getByRole('heading', { name: 'Plan with the concierge' })).toBeVisible();
  // If the AI is not configured the page surfaces an unavailable banner; in
  // that environment there is nothing to assert, so skip rather than fail.
  const unavailable = page.getByText(/not configured|unavailable/i);
  if (await unavailable.isVisible({ timeout: 3_000 }).catch(() => false)) {
    test.skip(true, 'AI concierge is not configured on this environment.');
  }

  const composer = page.getByLabel('Message the concierge');

  // 3. Compose ------------------------------------------------------------
  await composer.fill('Plan me a 3-day trip to Angkor Wat in Siem Reap, two guests, mid-range budget.');
  await page.getByRole('button', { name: 'Send' }).click();

  // The concierge streams an answer and, for a trip request, composes trip
  // cards into the content stage. Wait for the conversation region to populate
  // (any agent-authored turn), then for a Cambodia-flavoured token to land.
  await expect(page.getByRole('region', { name: 'Conversation with the concierge' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Angkor|Siem Reap|temple/i).first()).toBeVisible({
    timeout: 60_000,
  });

  // 4. Hold ---------------------------------------------------------------
  await composer.fill('Hold this trip for me.');
  await page.getByRole('button', { name: 'Send' }).click();

  // A hold renders as a booking card ("Your booking") with a reference and a
  // 15-minute countdown, plus a "Pay now" link into checkout. The LLM's hold
  // turn can run long, so allow ample time.
  await expect(page.getByRole('region', { name: 'Your booking' })).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.getByText('Held for you')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pay now' })).toBeVisible();
});