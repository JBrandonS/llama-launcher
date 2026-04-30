import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath, URL } from 'node:url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Playwright E2E configuration for llama-launcher.
 *
 * Spins up the Vite dev server + Python API server,
 * then runs browser tests against the real UI.
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Global timeout: 30s for full test, 10s for actions */
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },

  /* Retry flaky tests once (no CI in dev) */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'html' : 'list',

  /* Shared browser settings */
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  /* Start Vite dev server before tests */
  webServer: {
    command: 'npm run dev',
    port: 3000,
    timeout: 20_000,
    reuseExistingServer: !process.env.CI,
    cwd: __dirname,
  },

  /* Per-project config — can expand for CT later */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
