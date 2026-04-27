import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  projects: [
    // Desktop Chrome — default for PR runs
    { name: 'chromium', use: { browserName: 'chromium' } },
    // B-P6 task 7.1 — mobile matrix（CI main branch 跑 full 含這 2 個；PR 只跑 chromium）
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 3000',
    port: 3000,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
