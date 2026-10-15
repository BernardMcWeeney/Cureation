import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: process.env.AUDIT_BASE_URL || 'http://localhost:4325',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', channel: process.platform === 'darwin' ? 'chrome' : undefined, viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { browserName: 'chromium', channel: process.platform === 'darwin' ? 'chrome' : undefined, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    ...(process.env.TEST_FIREFOX ? [{ name: 'firefox', use: { browserName: 'firefox' as const, viewport: { width: 1440, height: 1000 } } }] : []),
  ],
});
