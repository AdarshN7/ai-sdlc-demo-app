import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx next start -p 3001',
    cwd: '..',
    url: 'http://localhost:3001',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ALLOW_TEST_RESET: 'true',
    },
  },
});
