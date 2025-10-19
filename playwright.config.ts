import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Planning Poker E2E tests
 *
 * Tests run against a local Wrangler dev server to test the full application
 * including WebSocket connections, Durable Objects, and real-time features.
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:8787',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:8787',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes to start
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
