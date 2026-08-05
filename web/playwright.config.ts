import { defineConfig, devices } from '@playwright/test'

const PORT = 3002
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

/*
 * The dev server compiles routes on demand, which makes the first interaction on
 * each route race against compilation and produces flaky timeouts under parallel
 * workers. Tests therefore run against a production build by default; set
 * E2E_DEV=1 for a faster inner loop when iterating on a single spec.
 */
const useDevServer = process.env.E2E_DEV === '1'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: useDevServer ? 'npm run dev' : 'npm run build && npm run start',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
