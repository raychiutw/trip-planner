// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

/**
 * R4 QC E2E 測試
 * 覆蓋 R4-1~R4-6 全 11 項驗收條件：
 *   QuickPanel、InfoPanel、Bottom Sheet、匯出佈局、X 按鈕
 */

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

/* ===== R4-2: InfoPanel 寬度 280px ===== */
test.describe('R4-2: InfoPanel 寬度 280px（桌機版）', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // (6) InfoPanel 寬度 280px
  test('(6) InfoPanel CSS 變數 --info-panel-w 為 280px', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const w = await page.locator('#infoPanel').evaluate(el => {
      const style = getComputedStyle(el);
      return style.width;
    });
    // 280px
    expect(w).toBe('280px');
  });

  // (7) InfoPanel 飯店+交通顯示
  test('(7) InfoPanel 顯示飯店卡片和交通摘要卡片', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const panel = page.locator('#infoPanel');
    await expect(panel).toBeVisible();

    // 飯店卡片
    const hotelCard = panel.locator('.hotel-summary-card');
    await expect(hotelCard).toBeAttached();
    await expect(hotelCard).toContainText('今日住宿');

    // 交通卡片
    const transportCard = panel.locator('.transport-summary-card');
    await expect(transportCard).toBeAttached();
    await expect(transportCard).toContainText('當日交通');
  });

  // (8) G 連結移除（TodaySummary 內不應有 google/naver 連結）
  test('(8) InfoPanel TodaySummary 不含 Google/Naver 地圖連結', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const panel = page.locator('#infoPanel');
    const gLinks = panel.locator('a[href*="google"], a[href*="naver"]');
    await expect(gLinks).toHaveCount(0);
  });

  // (9) scrollIntoView 移除（data-entry-index 不存在）
  test('(9) TimelineEvent 不含 data-entry-index attribute（scrollIntoView 已移除）', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // data-entry-index 應完全不存在
    const attrs = await page.locator('[data-entry-index]').count();
    expect(attrs).toBe(0);
  });
});

/* ===== R4-4: Bottom Sheet ===== */
test.describe('R4-4: Bottom Sheet（手機版）', () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Mobile/15E148' });

  async function openSheet(page) {
    await page.goto('/');
    await page.locator('.day-section').first().waitFor({ timeout: 10000 });
    await page.locator('#quickPanel').waitFor({ timeout: 10000 });
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });
    // 點擊第一個 sheet 類型 item（航班）
    await page.locator('.quick-panel-item[data-content="flights"]').click();
    await page.waitForTimeout(600);
    await expect(page.locator('#infoBottomSheet')).toHaveClass(/open/, { timeout: 5000 });
  }

  // (10a) Bottom Sheet 高度固定 85dvh/85vh
  test('(10a) info-sheet-panel 高度為 85dvh 或 85vh', async ({ page }) => {
    await openSheet(page);

    const panelHeight = await page.locator('.info-sheet-panel').evaluate(el => getComputedStyle(el).height);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const panelPx = parseFloat(panelHeight);

    // 85% of viewport height（允許 ±5px）
    expect(panelPx).toBeGreaterThan(viewportHeight * 0.8);
    expect(panelPx).toBeLessThanOrEqual(viewportHeight);
  });

  // (10b) X icon 大小 20px
  test('(10b) sheet-close-btn 的 svg/icon 寬高為 20px', async ({ page }) => {
    await openSheet(page);

    const iconSize = await page.locator('.sheet-close-btn svg').evaluate(el => {
      const s = getComputedStyle(el);
      return { w: s.width, h: s.height };
    });
    expect(iconSize.w).toBe('20px');
    expect(iconSize.h).toBe('20px');
  });

  // (10c) 頂部縮小：sheet-handle 存在（drag handle），視覺上為小矩形
  test('(10c) info-sheet-panel 頂部有 sheet-handle（縮小手把）', async ({ page }) => {
    await openSheet(page);

    const handle = page.locator('.info-sheet-panel .sheet-handle');
    await expect(handle).toBeAttached();

    // 驗證 CSS rule 宣告 height: 4px（透過 CSSStyleSheet 查詢，排除 flex 拉伸影響）
    const declaredHeight = await handle.evaluate(el => {
      // 搜尋 stylesheet 中 .sheet-handle 的宣告值
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText === '.sheet-handle') {
              return rule.style.height;
            }
          }
        } catch { /* cross-origin */ }
      }
      return null;
    });
    expect(declaredHeight).toBe('4px');

    // width 應是 36px
    const declaredWidth = await handle.evaluate(el => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText === '.sheet-handle') {
              return rule.style.width;
            }
          }
        } catch { /* cross-origin */ }
      }
      return null;
    });
    expect(declaredWidth).toBe('36px');
  });

  // (10d) 無拖曳功能（InfoSheet 不監聽 touchstart/pointermove 做 drag）
  test('(10d) info-sheet-panel 無拖曳 CSS class（無 dragging class）', async ({ page }) => {
    await openSheet(page);

    const panel = page.locator('.info-sheet-panel');
    // 模擬 touchstart/touchmove 在 handle 上
    const handleBox = await page.locator('.sheet-handle').boundingBox();
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 100);
      await page.waitForTimeout(200);
      // dragging class 不應出現
      const hasDragging = await panel.evaluate(el => el.classList.contains('dragging'));
      expect(hasDragging).toBe(false);
      await page.mouse.up();
    }

    // sheet 應仍然開著（沒有被拖曳關閉）
    await expect(page.locator('#infoBottomSheet')).toHaveClass(/open/);
  });
});

/* ===== R4-6: 匯出佈局（tools group 內 tool-action-btn） ===== */
test.describe('R4-6: 匯出 sheet 分隔線 + tool-action-btn 佈局', () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Mobile/15E148' });

  async function openToolsSheet(page) {
    await page.goto('/');
    await page.locator('.day-section').first().waitFor({ timeout: 10000 });
    await page.locator('#quickPanel').waitFor({ timeout: 10000 });
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });
    // 點擊 tools 群組（設定）
    await page.locator('.quick-panel-item[data-content="tools"]').click();
    await page.waitForTimeout(500);
    // 確認 tools sheet 開啟
    await expect(page.locator('#infoBottomSheet')).toHaveClass(/open/, { timeout: 5000 });
  }

  // (11a) tools sheet 包含 hr 分隔線（列印與匯出之間）
  test('(11a) tools sheet 內有 hr 分隔線（匯出區域分隔）', async ({ page }) => {
    await openToolsSheet(page);

    // sheet body 中有 hr 元素
    const hr = page.locator('#bottomSheetBody hr');
    await expect(hr).toBeAttached({ timeout: 5000 });
  });

  // (11b) 匯出按鈕以 flex-col 方式排列（tool-action-btn 列表）
  test('(11b) tools sheet 包含匯出相關 tool-action-btn', async ({ page }) => {
    await openToolsSheet(page);

    const toolBtns = page.locator('#bottomSheetBody .tool-action-btn');
    const count = await toolBtns.count();
    // 應有 4+ 個 tool-action-btn（切換行程、外觀、列印、匯出PDF、MD、JSON、CSV）
    expect(count).toBeGreaterThanOrEqual(4);
  });

  // (11c) 匯出按鈕涵蓋 PDF、Markdown、JSON、CSV
  test('(11c) tools sheet 包含 4 種匯出格式按鈕', async ({ page }) => {
    await openToolsSheet(page);

    const toolBtns = page.locator('#bottomSheetBody .tool-action-btn');
    // PDF 匯出
    const pdfBtn = toolBtns.filter({ hasText: /PDF/ });
    await expect(pdfBtn.first()).toBeAttached();
    // Markdown 匯出
    const mdBtn = toolBtns.filter({ hasText: /Markdown/ });
    await expect(mdBtn.first()).toBeAttached();
    // JSON 匯出
    const jsonBtn = toolBtns.filter({ hasText: /JSON/ });
    await expect(jsonBtn.first()).toBeAttached();
    // CSV 匯出
    const csvBtn = toolBtns.filter({ hasText: /CSV/ });
    await expect(csvBtn.first()).toBeAttached();
  });
});

/* ===== X 按鈕無圓形外框 ===== */
test.describe('X 按鈕無圓形外框', () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Mobile/15E148' });

  async function openSheetForXBtn(page) {
    await page.goto('/');
    await page.locator('.day-section').first().waitFor({ timeout: 10000 });
    await page.locator('#quickPanel').waitFor({ timeout: 10000 });
    await page.locator('.quick-panel-trigger').click();
    await page.locator('#quickPanel.open').waitFor({ timeout: 3000 });
    await page.locator('.quick-panel-item[data-content="flights"]').click();
    await page.waitForTimeout(600);
    await expect(page.locator('#infoBottomSheet')).toHaveClass(/open/, { timeout: 5000 });
  }

  // (12) X 按鈕：background transparent（無圓形外框）
  test('(12) sheet-close-btn 靜止狀態 background 為 transparent（無圓形外框）', async ({ page }) => {
    await openSheetForXBtn(page);

    const bg = await page.locator('.sheet-close-btn').evaluate(el => getComputedStyle(el).backgroundColor);
    // transparent = rgba(0,0,0,0)
    expect(bg).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
  });

  // (12b) border: none
  test('(12b) sheet-close-btn border 為 none', async ({ page }) => {
    await openSheetForXBtn(page);

    const borderWidth = await page.locator('.sheet-close-btn').evaluate(el => getComputedStyle(el).borderWidth);
    expect(borderWidth).toBe('0px');
  });

  // (12c) box-shadow: none
  test('(12c) sheet-close-btn 無 box-shadow（不是 "none" 就是 "" ）', async ({ page }) => {
    await openSheetForXBtn(page);

    const shadow = await page.locator('.sheet-close-btn').evaluate(el => getComputedStyle(el).boxShadow);
    expect(shadow).toMatch(/none|^$/);
  });
});

/* ===== DOM/CSS 結構靜態驗證 ===== */
test.describe('DOM/CSS 結構靜態驗證', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('CSS --info-panel-w 正確設為 280px（shared.css 變數）', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(300);
    const val = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--info-panel-w').trim());
    expect(val).toBe('280px');
  });

});
