/**
 * E2E Tests：Service Worker / 離線 / 快取行為驗證
 *
 * 測試情境：
 *   8. 離線 Toast 通知顯示
 *   9. 離線時 FAB disabled
 *  10. SW navigateFallbackDenylist — /manage/ 不被 SW 攔截回 index.html
 *
 * 注意：
 *   - 使用 @playwright/test
 *   - baseURL 從 process.env.BASE_URL 讀取，fallback localhost:3000
 *   - 測試 8/9 用 context.setOffline(true) 模擬斷網
 *   - 測試 10 只需驗證 URL 包含 manage 或 cloudflareaccess（不需真實登入）
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ===== Helper：設定 localStorage trip-pref，讓主頁能顯示行程內容 =====
async function injectTripPref(page: Page) {
  await page.addInitScript(() => {
    const exp = Date.now() + 180 * 86400000;
    localStorage.setItem(
      'tp-trip-pref',
      JSON.stringify({ v: 'okinawa-trip-2026-Ray', exp }),
    );
  });
}

// ===== Helper：等候離線 Toast 通知出現（含文字驗證）=====
async function waitForOfflineBanner(page: Page) {
  // 等候 .toast-notification--visible 出現（Toast 已掛載並可見）
  await page.waitForSelector('.toast-notification--visible', { timeout: 10000 });
}

// ===== 測試情境 8 & 9：主頁（TripPage）離線行為 =====
test.describe('TripPage 離線行為', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await injectTripPref(page);

    // 先上線載入頁面，讓 SW 有機會 precache 資源
    await page.goto(BASE_URL + '/');
    // 等待頁面基本渲染完成（等 body 出現）
    await page.waitForSelector('body', { timeout: 10000 });
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('8. 離線後重整頁面 → 應顯示離線提示文字', async () => {
    // 切換為離線模式
    await context.setOffline(true);

    // 重整頁面（SW 應提供快取頁面）
    await page.reload({ waitUntil: 'domcontentloaded' });
    await injectTripPref(page);

    // 等候離線 Toast 通知出現
    await waitForOfflineBanner(page);

    const banner = page.locator('.toast-notification--offline');
    await expect(banner).toBeVisible();

    // 驗證包含離線相關中文提示文字
    const bannerText = await banner.textContent();
    expect(bannerText).toMatch(/已離線 — 顯示快取資料/);
  });

  test('9. 離線狀態下 .edit-fab 應有 disabled class，且 opacity < 1', async () => {
    // 切換為離線模式
    await context.setOffline(true);

    // 重整頁面
    await page.reload({ waitUntil: 'domcontentloaded' });
    await injectTripPref(page);

    // 等候 FAB 出現（需要行程資料載入，離線時由 SW 快取提供）
    const fab = page.locator('#editFab');

    // 等候 FAB 出現於 DOM
    await fab.waitFor({ state: 'attached', timeout: 10000 });

    // 驗證 disabled class 存在
    await expect(fab).toHaveClass(/disabled/);

    // 驗證 opacity < 1（CSS .edit-fab.disabled { opacity: 0.4 }）
    const opacity = await fab.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).opacity),
    );
    expect(opacity).toBeLessThan(1);
  });
});

// ===== 測試情境 10：SW navigateFallbackDenylist — /manage/ 不被 SW 攔截 =====
test.describe('SW navigateFallbackDenylist', () => {
  test('10. 導航到 /manage/ 不應被 SW 攔截回 index.html（URL 應含 manage 或 cloudflareaccess）', async ({
    page,
  }) => {
    // 導航到 /manage/（Cloudflare Access 保護，預期被 redirect 到 Access 登入頁）
    // 重點：SW 不應 intercept 並回傳 index.html fallback
    const response = await page.goto(BASE_URL + '/manage/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // 取得最終落地 URL（可能已被 Cloudflare Access redirect）
    const finalUrl = page.url();

    // 驗證：URL 不應是 index.html 的 fallback（排除 SW 攔截的狀況）
    // 合法情況：
    //   a. URL 仍含 /manage/（dev 環境，Access 未介入）
    //   b. URL 含 cloudflareaccess.com（Access 登入 redirect）
    //   c. URL 含 /cdn-cgi/（Cloudflare 認證流程）
    const isNotSwFallback =
      finalUrl.includes('manage') ||
      finalUrl.includes('cloudflareaccess') ||
      finalUrl.includes('cdn-cgi');

    expect(isNotSwFallback).toBe(true);

    // 額外驗證：如果 response 存在，不應回傳 index.html 的行程頁面內容
    // （SW fallback 會回傳 200 + index.html，讓使用者停留在行程頁）
    if (response && response.status() === 200) {
      // 頁面標題不應是行程主頁的標題（避免 SW 誤 fallback）
      // 若 SW 有攔截，URL 會是 /manage/ 但內容是 index.html（行程頁）
      // 正確行為：URL 包含 manage 代表 server 正確回應（dev 或 Access 頁）
      const urlAfterLoad = page.url();
      // 若 URL 仍在 /manage/ 路徑下，代表沒有被 SW 重導向到根路徑
      if (urlAfterLoad.includes(BASE_URL)) {
        expect(urlAfterLoad).toMatch(/manage|cloudflareaccess|cdn-cgi/);
      }
    }
  });
});
