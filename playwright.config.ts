import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  /* Two suites (ADR 0011): e2e stories under tests/stories/ drive the real app, and
   * colocated *.integration.ts specs mount one component in the ADR 0014 gallery. Each
   * has its own project below, with its own server and its own testDir; tests/flows/
   * holds Flow helpers, not specs, so nothing matches it. */
  testDir: '.',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Stories build their Trackers through the UI against the unoptimised dev server, so
   * a single story legitimately runs far longer than the 30s default. */
  timeout: 60_000,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env['CI'],
  /* Retry on CI only */
  retries: process.env['CI'] ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env['CI'] ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: 'http://localhost:4200',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* The real app for the stories (ADR 0011 — e2e drives the real app, not a mock), and
   * the component gallery for the integration specs (ADR 0014). */
  webServer: [
    {
      command: 'pnpm start',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'pnpm run gallery',
      url: 'http://localhost:4201',
      reuseExistingServer: !process.env['CI'],
    },
  ],

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      testDir: './tests',
      testMatch: 'stories/**/*.e2e.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      testDir: './tests',
      testMatch: 'stories/**/*.e2e.ts',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      testDir: './tests',
      testMatch: 'stories/**/*.e2e.ts',
      use: { ...devices['Desktop Safari'] },
    },

    {
      /* One component at a time, against the gallery — no app boot, no IndexedDB, so
       * these are fast and run in one browser only. */
      name: 'integration',
      testDir: './src',
      testMatch: '**/*.integration.ts',
      timeout: 30_000,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4201' },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],
});
