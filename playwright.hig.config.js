// HIG 取證場景的 CI／本機入口：只跑 hig-scenes（棘輪）與 hig-a11y-collect（需 HIG_COLLECT=1），
// 擁有兩台 server（見 playwright.hig-servers.js）。用法：npx playwright test -c playwright.hig.config.js --project=chromium
import { defineConfig } from '@playwright/test';
const { HIG_WEB_SERVERS, HIG_SPECS } = require('./playwright.hig-servers.js');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: HIG_SPECS,
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 1,
  use: { baseURL: 'http://localhost:3000', headless: true, serviceWorkers: 'block' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: HIG_WEB_SERVERS,
});
