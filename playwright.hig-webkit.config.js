// HIG 取證用：只跑桌機 webkit（Safari 引擎），不影響預設的 playwright.config.js 與 CI 的 project 組合。
// 用法：HIG_COLLECT=1 HIG_SHOT_DIR=/path npx playwright test -c playwright.hig-webkit.config.js hig-scenes hig-a11y-collect
// webkit 只在 HIG_COLLECT 模式下截圖與掃描（棘輪以 chromium 為準）；需先 `npx playwright install webkit`。
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 40000,
  workers: 1,
  use: { baseURL: 'http://localhost:3000', headless: true, serviceWorkers: 'block' },
  projects: [{ name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: [
    { command: 'npm run build && npx vite preview --port 3000', port: 3000, reuseExistingServer: true, timeout: 120000 },
    // 新 api 認證旗標開啟的建置（見 playwright.config.js）
    {
      command: 'VITE_NEW_API_AUTH=1 VITE_API_BASE_URL=http://localhost:3001 npx vite build --outDir dist-newapi && npx vite preview --outDir dist-newapi --port 3001',
      port: 3001,
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
