import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  // v2.33.65 round 15: CI retries=2 (吸收 transient network / SW race flake;
  // local dev 仍 retries=0 fail fast)。workers=2 in CI for parallel run。
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 1,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    serviceWorkers: 'block',
  },
  projects: [
    // Desktop Chrome — default for PR runs
    { name: 'chromium', use: { browserName: 'chromium' } },
    // B-P6 task 7.1 — mobile matrix（CI main branch 跑 full 含這 2 個；PR 只跑 chromium）
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'], browserName: 'chromium' } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 3000',
    port: 3000,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
