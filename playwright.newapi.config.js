// 真 auth（PKCE＋DPoP）的 e2e：不套穿透版（見 vite.config.ts 的 authPassthrough），另建一份（dist-newapi-e2e），
// API 網址指向本機有狀態的假 api（tests/e2e/_helpers/fake-new-api.cjs，跨埠，和 production 的 web ↔ api 一樣是跨 origin）。
// 用法：npx playwright test -c playwright.newapi.config.js
// 不連任何外部網路、不用真實帳號；CI 的獨立步驟會跑它（見 .github/workflows/ci.yml）。
import { defineConfig } from '@playwright/test';

const WEB = 3101;
const API = 3102;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /(new-api-e2e|cold-load-waterfall)\.spec\.js$/,
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // 假 api 的狀態是全域的，測試之間靠 /__fake/reset 隔離，不能平行
  use: { baseURL: `http://localhost:${WEB}`, headless: true, serviceWorkers: 'block' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: 'node tests/e2e/_helpers/fake-new-api.cjs',
      port: API,
      env: { FAKE_API_PORT: String(API), FAKE_WEB_ORIGIN: `http://localhost:${WEB}` },
      reuseExistingServer: false,
      timeout: 15000,
    },
    {
      command: `VITE_API_BASE_URL=http://localhost:${API} npx vite build --outDir dist-newapi-e2e && npx vite preview --outDir dist-newapi-e2e --port ${WEB}`,
      port: WEB,
      reuseExistingServer: false,
      timeout: 180000,
    },
  ],
});
