// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

/**
 * Playwright E2E 測試：setting.html 設定頁
 */

test.beforeEach(async ({ page }) => {
  // Setup API mocks BEFORE navigation
  await setupApiMocks(page);

  await page.route('**/api.open-meteo.com/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hourly: { time: [], temperature_2m: [], precipitation_probability: [], weather_code: [] } }),
    });
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem('tp-trip-pref')) {
      var exp = Date.now() + 180 * 86400000;
      localStorage.setItem('tp-trip-pref', JSON.stringify({ v: 'okinawa-trip-2026-Ray', exp: exp }));
    }
  });
});

/* ===== 1. 頁面載入 ===== */
test.describe('設定頁載入', () => {
  test('頁面標題包含設定', async ({ page }) => {
    await page.goto('/setting.html');
    await expect(page).toHaveTitle(/設定/);
  });

  test('顯示「選擇行程」區段', async ({ page }) => {
    await page.goto('/setting.html');
    await expect(page.getByText('選擇行程')).toBeVisible();
  });

  test('顯示行程按鈕清單', async ({ page }) => {
    await page.goto('/setting.html');
    await page.waitForTimeout(1000);
    const tripBtns = page.locator('.trip-btn');
    const count = await tripBtns.count();
    expect(count).toBeGreaterThan(0);
  });

  test('當前行程按鈕有 active class', async ({ page }) => {
    await page.goto('/setting.html');
    await page.waitForTimeout(1000);
    const activeBtn = page.locator('.trip-btn.active');
    await expect(activeBtn).toHaveCount(1);
    const tripId = await activeBtn.getAttribute('data-trip-id');
    expect(tripId).toBe('okinawa-trip-2026-Ray');
  });

  test('顯示「外觀」區段與三張色彩模式卡片', async ({ page }) => {
    await page.goto('/setting.html');
    await page.waitForTimeout(1000);
    await expect(page.getByText('外觀')).toBeVisible();
    const colorCards = page.locator('.color-mode-card');
    await expect(colorCards).toHaveCount(3);
  });
});

/* ===== 2. 行程切換 ===== */
test.describe('行程切換', () => {
  test('點擊行程按鈕後 localStorage 更新並導航', async ({ page }) => {
    await page.goto('/setting.html');
    await page.waitForTimeout(1000);

    // 找一個非 active 的行程按鈕
    const inactiveBtn = page.locator('.trip-btn:not(.active)').first();
    const targetSlug = await inactiveBtn.getAttribute('data-trip-id');

    // 點擊後會導航到 index.html（serve 會 resolve 為 /）
    await Promise.all([
      page.waitForNavigation(),
      inactiveBtn.click(),
    ]);

    // 導航後 localStorage 應已更新
    const saved = await page.evaluate(() => {
      var raw = localStorage.getItem('tp-trip-pref');
      return raw ? JSON.parse(raw).v : null;
    });
    expect(saved).toBe(targetSlug);
  });
});

/* ===== 3. 色彩模式切換 ===== */
test.describe('色彩模式切換', () => {
  test('點擊深色卡片切換為 dark mode', async ({ page }) => {
    await page.goto('/setting.html');
    await page.waitForTimeout(1000);

    const darkCard = page.locator('.color-mode-card[data-mode="dark"]');
    await darkCard.click();

    // body 應有 dark class
    await expect(page.locator('body')).toHaveClass(/dark/);

    // 卡片應為 active
    await expect(darkCard).toHaveClass(/active/);

    // localStorage 應記錄
    const mode = await page.evaluate(() => {
      var raw = localStorage.getItem('tp-color-mode');
      return raw ? JSON.parse(raw).v : null;
    });
    expect(mode).toBe('dark');
  });

  test('點擊淺色卡片切換為 light mode', async ({ page }) => {
    // 先設為 dark
    await page.addInitScript(() => {
      var exp = Date.now() + 180 * 86400000;
      localStorage.setItem('tp-color-mode', JSON.stringify({ v: 'dark', exp: exp }));
    });
    await page.goto('/setting.html');
    await page.waitForTimeout(1000);

    const lightCard = page.locator('.color-mode-card[data-mode="light"]');
    await lightCard.click();

    await expect(page.locator('body')).not.toHaveClass(/dark/);
    await expect(lightCard).toHaveClass(/active/);
  });

  test('點擊自動卡片切換為 auto mode', async ({ page }) => {
    await page.goto('/setting.html');
    await page.waitForTimeout(1000);

    const autoCard = page.locator('.color-mode-card[data-mode="auto"]');
    await autoCard.click();
    await expect(autoCard).toHaveClass(/active/);

    const mode = await page.evaluate(() => {
      var raw = localStorage.getItem('tp-color-mode');
      return raw ? JSON.parse(raw).v : null;
    });
    expect(mode).toBe('auto');
  });

  test('色彩模式 reload 後保持', async ({ page }) => {
    await page.goto('/setting.html');
    await page.waitForTimeout(1000);

    // 切換到深色
    await page.locator('.color-mode-card[data-mode="dark"]').click();
    await expect(page.locator('body')).toHaveClass(/dark/);

    // Reload
    await page.reload();
    await page.waitForTimeout(1000);

    // 仍為 dark
    await expect(page.locator('body')).toHaveClass(/dark/);
    await expect(page.locator('.color-mode-card[data-mode="dark"]')).toHaveClass(/active/);
  });
});

/* ===== 4. 捲動穩定性 ===== */
test.describe('捲動穩定性', () => {
  test('捲動到底部後不會彈回頂部', async ({ page }) => {
    await page.goto('/setting.html');
    await page.waitForSelector('.trip-btn');
    await page.waitForSelector('.color-mode-card');

    // 捲動到頁面底部
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);

    const scrollAfter = await page.evaluate(() => window.scrollY);

    // 等待確認不會彈回
    await page.waitForTimeout(1000);

    const scrollFinal = await page.evaluate(() => window.scrollY);

    // 最終位置應與捲動後位置相同（允許 2px 誤差）
    expect(Math.abs(scrollFinal - scrollAfter)).toBeLessThanOrEqual(2);
    // 且不應在頂部（若頁面可捲動）
    if (scrollAfter > 0) {
      expect(scrollFinal).toBeGreaterThan(0);
    }
  });
});

/* ===== 5. 關閉按鈕 ===== */
test.describe('關閉按鈕', () => {
  test('X 按鈕存在', async ({ page }) => {
    await page.goto('/setting.html');
    const closeBtn = page.locator('#navCloseBtn');
    await expect(closeBtn).toBeVisible();
  });
});
