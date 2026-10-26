import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const root = resolve(import.meta.dirname);
const cliEntry = resolve(root, 'node_modules/supabase/dist/supabase.js');
const status = execFileSync(process.execPath, [cliEntry, 'status', '-o', 'env'], { cwd: root, encoding: 'utf8' });
const local = Object.fromEntries(status.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  return match ? [[match[1], match[2].replace(/^"|"$/g, '')]] : [];
}));
for (const key of ['API_URL', 'PUBLISHABLE_KEY', 'SERVICE_ROLE_KEY']) {
  if (!local[key]) throw new Error(`Local Supabase did not provide ${key}`);
}
process.env.OPERATIONS_TEST_API_URL = local.API_URL;
process.env.OPERATIONS_TEST_PUBLISHABLE_KEY = local.PUBLISHABLE_KEY;
process.env.OPERATIONS_TEST_SERVICE_ROLE_KEY = local.SERVICE_ROLE_KEY;

const port = process.env.PLAYWRIGHT_OPERATIONS_PORT ?? '8082';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/operations-web',
  fullyParallel: false,
  timeout: 90_000,
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: {
    command: `pnpm --filter @tawreed/operations web -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      EXPO_PUBLIC_SUPABASE_URL: local.API_URL,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
    },
  },
  projects: [
    { name: 'operations-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'operations-mobile', use: { ...devices['Pixel 7'] } },
    { name: 'operations-small-mobile', use: { browserName: 'chromium', viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' } },
    { name: 'operations-mobile-landscape', use: { browserName: 'chromium', viewport: { width: 812, height: 375 }, reducedMotion: 'reduce' } },
  ],
});
