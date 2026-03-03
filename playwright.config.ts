/**
 * Playwright config for E2E tests (Phase 8.3).
 * Run: npx playwright test
 */

import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:3000'

/** CI database URL – must match PostgreSQL service user (ci) in .github/workflows/ci.yml */
const CI_DATABASE_URL = 'postgresql://ci:ci@localhost:5432/ci?schema=public'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60000,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: process.env.CI
    ? [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      ],
  webServer:
    process.env.CI
      ? {
          command: 'npm run build && npm run start',
          url: baseURL,
          timeout: 180000,
          reuseExistingServer: false,
          env: {
            ...process.env,
            DATABASE_URL: process.env.DATABASE_URL || CI_DATABASE_URL,
            AUTH_SECRET: process.env.AUTH_SECRET || 'ci-secret-minimum-32-characters-long',
            NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'ci-secret-minimum-32-characters-long',
            NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
            NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'ci-encryption-key-32-chars-long!',
          },
        }
      : {
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
        },
})
