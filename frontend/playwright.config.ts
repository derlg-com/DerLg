import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration for the DerLg frontend.
 *
 * Scope: the Vibe Booking concierge flow at `/vibe-booking`. These specs mock
 * the AI agent WebSocket in-browser (see `e2e/booking-flow.spec.ts`), so they
 * do NOT require the Python agent on `ws://localhost:8000` to be running.
 *
 * Vitest owns unit/integration tests under `tests/**`; Playwright owns only the
 * top-level `e2e/` directory so the two runners never collide.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // CI-friendly determinism: fail fast on stray `.only`, no implicit retries
  // locally, a single retry on CI to absorb cold-start flake.
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /**
   * Build then serve the production app on PORT. `reuseExistingServer` lets a
   * developer point the suite at an already-running `next start` (or the value
   * of E2E_BASE_URL) instead of paying the build cost every run.
   *
   * We use `build:next` (plain `next build`) rather than `build` to skip the
   * service-worker (serwist) step, which is irrelevant to these flows and keeps
   * the harness deterministic.
   */
  webServer: {
    command: `npm run build:next && npm run start -- --port ${PORT}`,
    url: BASE_URL,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
