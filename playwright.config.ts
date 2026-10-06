import { defineConfig, devices } from '@playwright/test'

export const E2E_DATABASE_URL =
  process.env.DATABASE_URL_E2E ?? 'postgres://rovor:rovor@localhost:5433/rovor_e2e'
const PORT = 3200

export default defineConfig({
  testDir: 'e2e',
  // One database shared by all tests, reset before each: run serially.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Production build, like the deployed app. Never reuse a running server: it may be stale.
    command: `node_modules/.bin/next build && node_modules/.bin/next start -p ${PORT}`,
    // `/` (static), not /api/health: on a first run the e2e database doesn't exist yet.
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: { DATABASE_URL: E2E_DATABASE_URL, LOG_LEVEL: 'warn' },
  },
})
