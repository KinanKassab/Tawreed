import { defineConfig, devices } from '@playwright/test';

const webPort = process.env.PLAYWRIGHT_PORT ?? '8081';
const webUrl = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: './tests/web',
  fullyParallel: true,
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm --filter @tawreed/doctor web -- --port ${webPort}`,
    url: webUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
  ],
});
