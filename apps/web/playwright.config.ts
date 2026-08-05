import { defineConfig, devices } from '@playwright/test';

/**
 * Golden-path E2E for DerLg web.
 *
 * These are the two journeys a release must not break, kept deliberately (not
 * throwaways): the manual booking funnel and the AI concierge funnel. An
 * accessibility audit runs alongside them.
 *
 * Prerequisites (documented in the repo README):
 *   - The API is up on :3101 with a migrated + seeded database and Redis.
 *   - `npm run dev` (web) on :3100 — started automatically by `webServer` below.
 *   - The AI golden path additionally needs a working OPENAI_API_KEY (NVIDIA NIM)
 *     so the concierge can actually compose and hold.
 *   - The card-payment step in the manual path needs Stripe test keys + a
 *     `stripe listen` webhook forwarder; without them the test stops at the
 *     checkout page and asserts the payment form renders.
 *
 * Run: `npm run e2e` (or `npm run e2e:ui` for headed debugging once added).
 */
const PORT = Number(process.env.WEB_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // golden paths share a seeded DB; serial is safer
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: { WEB_PORT: String(PORT) },
  },
});