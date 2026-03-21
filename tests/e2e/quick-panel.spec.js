// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

/**
 * Playwright E2E 測試：QuickPanel（快速選單）
 *
 * 涵蓋：
 *   1.  FAB 按鈕顯示（朝上三角形 SVG path）
 *   2.  點擊 FAB → panel 開啟，顯示 14 項 grid
 *   3.  點擊 backdrop → panel 關閉
 *   4.  點擊「航班」→ InfoSheet 開啟
 *   5.  點擊「切換行程」→ InfoSheet 顯示行程列表
 *   6.  FAB 開啟後隱藏
 *   7.  點擊「外觀主題」→ InfoSheet 顯示主題選擇器
 *   8.  主題切換即時生效（body class 更新）
 *   9.  Night 主題選擇（body 加 theme-night class）
 *   10. FAB 在列印模式下隱藏
 *   11. QuickPanel → InfoSheet 過渡連貫性
 *   12. 鍵盤 Escape 關閉 + X 按鈕關閉
 */

/**
 * PANEL_ITEMS 總數：14 項
 *   Section A (行程資訊): flights, checklist, emergency, backup = 4
 *   Section B (工具+設定): suggestions, today-route, driving, trip-select, appearance = 5
 *   Section C (匯出): printer, download-pdf, download-md, download-json, download-csv = 5
 */
const PANEL_ITEMS_COUNT = 14;

function buildWeatherMock(url) {
  const params = new URL(url).searchParams;
  const start = params.get('start_date'), end = params.get('end_date');
  if (!start || !end) return { hourly: { time: [], temperature_2m: [], precipitation_probability: [], weather_code: [] } };
  const time = [], temps = [], rains = [], codes = [];
  for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
    for (let h = 0; h < 24; h++) {
      time.push(d.toISOString().slice(0, 10) + 'T' + String(h).padStart(2, '0') + ':00');
      temps.push(28); rains.push(10); codes.push(0);
    }
  }
  return { hourly: { time, temperature_2m: temps, precipitation_probability: rains, weather_code: codes } };
}

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  await page.route('**/api.open-meteo.com/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildWeatherMock(route.request().url())),
    });
  });
  await page.addInitScript(() => {
    const exp = Date.now() + 180 * 86400000;
    localStorage.setItem('tp-trip-pref', JSON.stringify({ v: 'okinawa-trip-2026-Ray', exp }));
  });
});

/** 等待頁面與 QuickPanel 就緒 */
async function waitForPage(page) {
  await page.goto('/');
  await page.locator('.day-section').first().waitFor({ timeout: 10000 });
  // QuickPanel 只在 !loading && trip 後渲染
  await page.locator('#quickPanel').waitFor({ timeout: 10000 });
}

// ─────────────────────────────────────────────
// 1. FAB 按鈕顯示（朝上三角形）
// ─────────────────────────────────────────────
test.describe('(1) FAB 按鈕顯示', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('quick-panel-trigger 存在且可見', async ({ page }) => {
    await waitForPage(page);
    const fab = page.locator('.quick-panel-trigger');
    await expect(fab).toBeVisible();
    await expect(fab).toHaveAttribute('aria-label', '快速選單');
  });

  test('FAB 內含朝上三角形 SVG（path d="M12 8l-6 6h12z"）', async ({ page }) => {
    await waitForPage(page);
    const path = await page.locator('.quick-panel-arrow path').getAttribute('d');
    expect(path).toBe('M12 8l-6 6h12z');
  });
});

// ─────────────────────────────────────────────
// 2. 點擊 FAB → panel 開啟，顯示 14 項 grid
// ─────────────────────────────────────────────
test.describe('(2) 點擊 FAB 開啟 panel', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('點擊 FAB 後 #quickPanel 獲得 open class', async ({ page }) => {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await expect(page.locator('#quickPanel')).toHaveClass(/open/, { timeout: 3000 });
  });

  test(`panel 開啟後顯示 ${PANEL_ITEMS_COUNT} 個 grid 項目`, async ({ page }) => {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });

    // PANEL_ITEMS 共 14 項（section A: 4, section B: 5, section C: 5）
    const items = page.locator('.quick-panel-item');
    await expect(items).toHaveCount(PANEL_ITEMS_COUNT);
  });

  test('panel 開啟後 quick-panel-sheet 可見', async ({ page }) => {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });
    await expect(page.locator('.quick-panel-sheet')).toBeVisible();
  });

  test('aria-expanded 在開啟後為 true', async ({ page }) => {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });
    await expect(page.locator('.quick-panel-trigger')).toHaveAttribute('aria-expanded', 'true');
  });
});

// ─────────────────────────────────────────────
// 3. 點擊 backdrop → panel 關閉
// ─────────────────────────────────────────────
test.describe('(3) 點擊 backdrop 關閉 panel', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('點擊 backdrop 後 #quickPanel 失去 open class', async ({ page }) => {
    await waitForPage(page);

    // 開啟
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });

    // 點擊 backdrop
    await page.locator('.quick-panel-backdrop').click({ force: true });
    await expect(page.locator('#quickPanel')).not.toHaveClass(/open/, { timeout: 3000 });
  });

  test('關閉後 aria-expanded 為 false', async ({ page }) => {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });
    await page.locator('.quick-panel-backdrop').click({ force: true });
    await expect(page.locator('.quick-panel-trigger')).toHaveAttribute('aria-expanded', 'false', { timeout: 3000 });
  });
});

// ─────────────────────────────────────────────
// 4. 點擊「航班」項目 → InfoSheet 開啟
// ─────────────────────────────────────────────
test.describe('(4) 點擊「航班」→ InfoSheet 開啟', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('點擊 flights 項目後 InfoSheet 開啟', async ({ page }) => {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });

    await page.locator('.quick-panel-item[data-content="flights"]').click();

    // QuickPanel 應關閉
    await expect(page.locator('#quickPanel')).not.toHaveClass(/open/, { timeout: 3000 });
    // InfoSheet 應開啟
    await expect(page.locator('#infoBottomSheet')).toHaveClass(/open/, { timeout: 5000 });
  });

  test('航班 sheet 包含「航班」標題', async ({ page }) => {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });
    await page.locator('.quick-panel-item[data-content="flights"]').click();
    await page.locator('#infoBottomSheet.open').waitFor({ timeout: 5000 });

    const sheetTitle = page.locator('.sheet-title');
    await expect(sheetTitle).toContainText('航班');
  });
});

// ─────────────────────────────────────────────
// 5. 點擊「切換行程」→ InfoSheet 顯示行程列表
// ─────────────────────────────────────────────
test.describe('(5) 點擊「切換行程」→ InfoSheet', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('點擊 trip-select 後 InfoSheet 開啟並顯示「切換行程」標題', async ({ page }) => {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });

    await page.locator('.quick-panel-item[data-content="trip-select"]').click();

    // QuickPanel 關閉
    await expect(page.locator('#quickPanel')).not.toHaveClass(/open/, { timeout: 3000 });
    // InfoSheet 開啟
    await expect(page.locator('#infoBottomSheet')).toHaveClass(/open/, { timeout: 5000 });
    // 標題顯示「切換行程」
    await expect(page.locator('.sheet-title')).toContainText('切換行程');
  });

  test('InfoSheet 顯示行程列表（mock 有 2 筆已發布行程）', async ({ page }) => {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });
    await page.locator('.quick-panel-item[data-content="trip-select"]').click();
    await page.locator('#infoBottomSheet.open').waitFor({ timeout: 5000 });

    // mock data 有 2 筆 published=1 的行程
    const tripItems = page.locator('.trip-btn');
    await expect(tripItems).toHaveCount(2, { timeout: 5000 });
  });

  test('當前行程項目有 active class', async ({ page }) => {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });
    await page.locator('.quick-panel-item[data-content="trip-select"]').click();
    await page.locator('#infoBottomSheet.open').waitFor({ timeout: 5000 });

    const activeTrip = page.locator('.trip-btn.active');
    await expect(activeTrip).toHaveCount(1);
  });
});

// ─────────────────────────────────────────────
// 6. FAB 開啟後隱藏
// ─────────────────────────────────────────────
test.describe('(6) FAB 開啟後隱藏', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('panel 開啟後 FAB 透明且不可點擊', async ({ page }) => {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });

    // FAB 應透過 CSS 隱藏（opacity: 0, pointer-events: none）
    const fab = page.locator('.quick-panel-trigger');
    await expect(fab).toHaveCSS('opacity', '0');
    await expect(fab).toHaveCSS('pointer-events', 'none');
  });
});

// ─────────────────────────────────────────────
// 7. 點擊「外觀主題」→ InfoSheet 顯示主題選擇器
// ─────────────────────────────────────────────
test.describe('(7) 點擊「外觀主題」→ 主題選擇器', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function openAppearanceSheet(page) {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });
    await page.locator('.quick-panel-item[data-content="appearance"]').click();
    await page.locator('#infoBottomSheet.open').waitFor({ timeout: 5000 });
  }

  test('點擊 appearance 後 InfoSheet 顯示「外觀與主題」標題', async ({ page }) => {
    await openAppearanceSheet(page);
    await expect(page.locator('.sheet-title')).toContainText('外觀與主題');
  });

  test('顯示色彩模式選擇器（3 個 color-mode-card）', async ({ page }) => {
    await openAppearanceSheet(page);
    const modeCards = page.locator('.color-mode-card');
    await expect(modeCards).toHaveCount(3);
  });

  test('顯示主題色選擇器（6 個 color-theme-card）', async ({ page }) => {
    await openAppearanceSheet(page);
    const themeCards = page.locator('.color-theme-card');
    await expect(themeCards).toHaveCount(6);
  });
});

// ─────────────────────────────────────────────
// 8. 主題切換即時生效（body class 更新）
// ─────────────────────────────────────────────
test.describe('(8) 主題切換即時生效', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function openAppearanceSheet(page) {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });
    await page.locator('.quick-panel-item[data-content="appearance"]').click();
    await page.locator('#infoBottomSheet.open').waitFor({ timeout: 5000 });
  }

  test('切換到「晴空」主題後 body 有 theme-sky class', async ({ page }) => {
    await openAppearanceSheet(page);
    // 點擊「晴空（sky）」主題按鈕
    await page.locator('.color-theme-card[data-theme="sky"]').click();
    await expect(page.locator('body')).toHaveClass(/theme-sky/);
  });

  test('切換到「和風」主題後 body 有 theme-zen class', async ({ page }) => {
    await openAppearanceSheet(page);
    await page.locator('.color-theme-card[data-theme="zen"]').click();
    await expect(page.locator('body')).toHaveClass(/theme-zen/);
  });
});

// ─────────────────────────────────────────────
// 9. Night 主題選擇（body 加 theme-night class）
// ─────────────────────────────────────────────
test.describe('(9) Night 主題選擇', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function openAppearanceSheet(page) {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });
    await page.locator('.quick-panel-item[data-content="appearance"]').click();
    await page.locator('#infoBottomSheet.open').waitFor({ timeout: 5000 });
  }

  test('選擇「星夜」主題後 body 有 theme-night class', async ({ page }) => {
    await openAppearanceSheet(page);
    await page.locator('.color-theme-card[data-theme="night"]').click();
    await expect(page.locator('body')).toHaveClass(/theme-night/);
  });

  test('選擇「星夜」後主題卡片獲得 active class', async ({ page }) => {
    await openAppearanceSheet(page);
    const nightCard = page.locator('.color-theme-card[data-theme="night"]');
    await nightCard.click();
    await expect(nightCard).toHaveClass(/active/);
  });
});

// ─────────────────────────────────────────────
// 10. FAB 在列印模式下隱藏
// ─────────────────────────────────────────────
test.describe('(10) FAB 在列印模式下隱藏', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('print-mode class 加到 body 後 quick-panel 不可見', async ({ page }) => {
    await waitForPage(page);

    // 確認 FAB 初始可見
    await expect(page.locator('.quick-panel-trigger')).toBeVisible();

    // 模擬列印模式：加入 print-mode class
    await page.evaluate(() => {
      document.body.classList.add('print-mode');
    });

    // 等待隱藏生效（assertion-based，取代 waitForTimeout）
    await expect(page.locator('#quickPanel')).toBeHidden();
  });

  test('移除 print-mode 後 FAB 再次可見', async ({ page }) => {
    await waitForPage(page);

    await page.evaluate(() => { document.body.classList.add('print-mode'); });
    await expect(page.locator('#quickPanel')).toBeHidden();

    await page.evaluate(() => { document.body.classList.remove('print-mode'); });

    await expect(page.locator('.quick-panel-trigger')).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// 11. QuickPanel → InfoSheet 過渡連貫性 (#4b)
// ─────────────────────────────────────────────
test.describe('(11) QuickPanel → InfoSheet 過渡連貫性', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('點擊 sheet item 後 QuickPanel 關閉同時 InfoSheet 開啟（無明顯延遲）', async ({ page }) => {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });

    // 記錄點擊時間
    const startTime = Date.now();
    await page.locator('.quick-panel-item[data-content="flights"]').click();

    // 同時驗證 QuickPanel 關閉和 InfoSheet 開啟
    await Promise.all([
      expect(page.locator('#quickPanel')).not.toHaveClass(/open/, { timeout: 3000 }),
      expect(page.locator('#infoBottomSheet')).toHaveClass(/open/, { timeout: 5000 }),
    ]);

    // 整體過渡應在 2 秒內完成（含動畫時間）
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(2000);
  });
});

// ─────────────────────────────────────────────
// 12. 鍵盤 Escape 關閉 + X 按鈕關閉 (#4c + #2b)
// ─────────────────────────────────────────────
test.describe('(12) 鍵盤 Escape 關閉 + X 按鈕關閉', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('panel 開啟時按 Escape 鍵關閉', async ({ page }) => {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });

    await page.keyboard.press('Escape');
    await expect(page.locator('#quickPanel')).not.toHaveClass(/open/, { timeout: 3000 });
  });

  test('點擊 X 關閉按鈕關閉 panel', async ({ page }) => {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });

    // X close button 在 quick-panel-sheet 內
    const closeBtn = page.locator('.quick-panel-sheet .sheet-close-btn');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(page.locator('#quickPanel')).not.toHaveClass(/open/, { timeout: 3000 });
  });

  test('X 關閉按鈕有正確的 aria-label', async ({ page }) => {
    await waitForPage(page);
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });

    const closeBtn = page.locator('.quick-panel-sheet .sheet-close-btn');
    await expect(closeBtn).toHaveAttribute('aria-label', '關閉');
  });
});
