import { defineConfig, devices } from '@playwright/test';
const { HIG_SPECS } = require('./playwright.hig-servers.js');

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
  // HIG 取證 specs 需要第二份新 api 旗標建置，另由 playwright.hig.config.js 執行（CI 有獨立步驟），這裡排除以免每次 e2e 多建一份。
  testIgnore: [HIG_SPECS, /new-api-e2e\.spec\.js$/], // 新 api 模式 e2e 另有 playwright.newapi.config.js
  webServer: {
    // 另建 dist-e2e：auth 換成穿透版（見 vite.config.ts 的 authPassthrough），不用正式建置（API 網址指向 production）
    command: 'E2E_AUTH_PASSTHROUGH=1 npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 3000',
    port: 3000,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
