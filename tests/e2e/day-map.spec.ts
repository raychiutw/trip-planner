/**
 * E2E 測試：DayMap 地圖元件（F002）
 *
 * 測試場景：
 *   1. 地圖區塊存在於頁面
 *   2. 預設展開（aria-expanded=true）
 *   3. 點擊收合按鈕 → 收合
 *   4. 再次點擊 → 展開
 *   5. localStorage 持久化收合狀態
 *
 * 注意：Google Maps SDK 需要 API key + 真實網路，E2E 環境中地圖可能顯示 error fallback。
 * 本測試只驗證容器存在 + 收合/展開行為，不驗證地圖渲染。
 */

import { test, expect } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);

  // Mock Google Maps SDK（避免 E2E 依賴外部 CDN）
  await page.route('**/maps.googleapis.com/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.google = {
          maps: {
            Map: function(el, opts) {
              this.fitBounds = function() {};
              this.setCenter = function() {};
            },
            LatLngBounds: function() { this.extend = function(){}; },
            ControlPosition: { RIGHT_BOTTOM: 7 },
            Marker: function() {},
            Polyline: function() {},
          }
        };
      `,
    });
  });

  // 設定預設行程
  await page.addInitScript(() => {
    const exp = Date.now() + 180 * 86400000;
    localStorage.setItem('tp-trip-pref', JSON.stringify({ v: 'okinawa-trip-2026-Ray', exp }));
  });
});

test.describe('DayMap — 地圖區塊存在', () => {
  test('1. 頁面載入後地圖區塊存在', async ({ page }) => {
    await page.goto('/');
    // 等待行程載入
    await page.waitForSelector('[data-testid="day-map-section"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="day-map-section"]').first()).toBeVisible();
  });
});

test.describe('DayMap — 收合/展開', () => {
  test('2. 預設展開：收合按鈕顯示「收合地圖」', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="day-map-section"]', { timeout: 10000 });

    // 取第一個 day-map-section
    const section = page.locator('[data-testid="day-map-section"]').first();
    const toggleBtn = section.locator('button').filter({ hasText: '收合地圖' });
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
  });

  test('3. 點擊收合按鈕 → 地圖收合，按鈕顯示「展開地圖」', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="day-map-section"]', { timeout: 10000 });

    const section = page.locator('[data-testid="day-map-section"]').first();
    const toggleBtn = section.locator('button').filter({ hasText: '收合地圖' });

    await toggleBtn.click();

    // 按鈕文字變為「展開地圖」
    await expect(section.locator('button').filter({ hasText: '展開地圖' })).toBeVisible();
    await expect(section.locator('button').filter({ hasText: '展開地圖' })).toHaveAttribute('aria-expanded', 'false');
  });

  test('4. 收合後再次點擊 → 展開，aria-expanded=true', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="day-map-section"]', { timeout: 10000 });

    const section = page.locator('[data-testid="day-map-section"]').first();

    // 收合
    await section.locator('button').filter({ hasText: '收合地圖' }).click();
    // 展開
    await section.locator('button').filter({ hasText: '展開地圖' }).click();

    await expect(section.locator('button').filter({ hasText: '收合地圖' })).toHaveAttribute('aria-expanded', 'true');
  });

  test('5. 收合狀態持久化到 localStorage', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="day-map-section"]', { timeout: 10000 });

    const section = page.locator('[data-testid="day-map-section"]').first();

    // 收合
    await section.locator('button').filter({ hasText: '收合地圖' }).click();

    // 確認 localStorage 有 map-collapsed=true
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('tp-map-collapsed');
      if (!raw) return null;
      try {
        return JSON.parse(raw).v;
      } catch {
        return null;
      }
    });

    expect(stored).toBe(true);
  });
});
