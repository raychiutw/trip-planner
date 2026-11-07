// HIG 取證用：只跑桌機 webkit（Safari 引擎），不影響預設的 playwright.config.js 與 CI 的 project 組合。
// 用法：HIG_COLLECT=1 HIG_SHOT_DIR=/path npx playwright test -c playwright.hig-webkit.config.js hig-scenes hig-a11y-collect
// webkit 只在 HIG_COLLECT 模式下截圖與掃描（棘輪以 chromium 為準）；需先 `npx playwright install webkit`。
import { defineConfig } from '@playwright/test';
const { HIG_WEB_SERVERS } = require('./playwright.hig-servers.js');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 40000,
  workers: 1,
  use: { baseURL: 'http://localhost:3000', headless: true, serviceWorkers: 'block' },
  projects: [{ name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: HIG_WEB_SERVERS,
});
