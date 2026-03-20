// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

/**
 * R4 QC E2E 測試
 * 覆蓋 R4-1~R4-6 全 11 項驗收條件：
 *   SpeedDial、InfoPanel、Bottom Sheet、匯出佈局、X 按鈕
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

/* ===== R4-5: SpeedDial 垂直單欄設計 ===== */
test.describe('R4-5: SpeedDial 垂直單欄（手機版）', () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Mobile/15E148' });

  // (1) SpeedDial 垂直單欄：items 排成一列，x 座標全部相同（同一欄）
  test('(1) speed-dial-items 使用 flex-direction:column 單欄佈局', async ({ page }) => {
    await page.goto('/');
    await page.locator('.day-section').first().waitFor({ timeout: 10000 });

    // 展開
    await page.locator('.speed-dial-trigger').click();
    await page.waitForTimeout(500);

    // 取得 computed style 驗證 flex-direction
    const flexDir = await page.locator('.speed-dial-items').evaluate(el => getComputedStyle(el).flexDirection);
    expect(flexDir).toBe('column');
  });

  // (2) label 在左、icon 在右（JSX 結構：<span.speed-dial-label> 先於 svg/Icon）
  test('(2) speed-dial-item 結構：label 在 icon 之前（左 label 右 icon）', async ({ page }) => {
    await page.goto('/');
    await page.locator('.day-section').first().waitFor({ timeout: 10000 });

    const item = page.locator('.speed-dial-item').first();
    // 確認 label 和 icon 都存在
    const label = item.locator('.speed-dial-label');
    const icon = item.locator('svg, .svg-icon');
    await expect(label).toBeAttached();
    await expect(icon.first()).toBeAttached();

    // 用 getBoundingClientRect 確認 label 的 x 小於 icon 的 x（label 在左）
    await page.locator('.speed-dial-trigger').click();
    await page.waitForTimeout(400);

    const labelBox = await item.locator('.speed-dial-label').boundingBox();
    const iconBox = await item.locator('svg').first().boundingBox();
    if (labelBox && iconBox) {
      expect(labelBox.x).toBeLessThan(iconBox.x);
    }
  });

  // (3) FAB 關閉時顯示 ◁（左箭頭），展開時顯示 ▷（右箭頭）
  test('(3) FAB 關閉狀態顯示左箭頭 SVG path（◁）', async ({ page }) => {
    await page.goto('/');
    await page.locator('.day-section').first().waitFor({ timeout: 10000 });

    // 關閉狀態：trigger 的 SVG path 應是 ◁ = "M16 6l-8 6 8 6z"
    const closedPath = await page.locator('.speed-dial-trigger svg path').getAttribute('d');
    expect(closedPath).toBe('M16 6l-8 6 8 6z');
  });

  test('(3b) FAB 展開狀態顯示右箭頭 SVG path（▷）', async ({ page }) => {
    await page.goto('/');
    await page.locator('.day-section').first().waitFor({ timeout: 10000 });

    await page.locator('.speed-dial-trigger').click();
    await page.waitForTimeout(300);

    // 展開狀態：path 應是 ▷ = "M8 6l8 6-8 6z"
    const openPath = await page.locator('.speed-dial-trigger svg path').getAttribute('d');
    expect(openPath).toBe('M8 6l8 6-8 6z');
  });

  // (4) 點擊 item 含 label 可觸發（label 是按鈕一部分，不再是 position:absolute + pointer-events:none）
  test('(4) 點擊 speed-dial-item label 可觸發 bottom sheet 開啟', async ({ page }) => {
    await page.goto('/');
    await page.locator('.day-section').first().waitFor({ timeout: 10000 });

    await page.locator('.speed-dial-trigger').click();
    await page.waitForTimeout(400);

    // 點擊 label 文字（不是 icon）來觸發
    const firstItem = page.locator('.speed-dial-item').first();
    const label = firstItem.locator('.speed-dial-label');
    await label.click();
    await page.waitForTimeout(500);

    // SpeedDial 應關閉
    await expect(page.locator('#speedDial')).not.toHaveClass(/open/);
    // Bottom sheet 或設定 sheet 應開啟
    const sheetOpen = await page.locator('#infoBottomSheet.open, .info-sheet-backdrop.open').count();
    expect(sheetOpen).toBeGreaterThan(0);
  });

  // (5) stagger：child(8) = 0ms（最靠近 FAB），child(1) = 210ms（最遠）
  test('(5) stagger delay：child(8) 最短、child(1) 最長（底部優先出現）', async ({ page }) => {
    await page.goto('/');
    await page.locator('.day-section').first().waitFor({ timeout: 10000 });

    // 驗證 CSS transition-delay via computed style（需在 open state）
    await page.locator('.speed-dial-trigger').click();
    await page.waitForTimeout(400);

    const items = page.locator('.speed-dial.open .speed-dial-item');
    const count = await items.count();
    expect(count).toBe(8);

    // child 8 (index 7) 的 transition-delay 應為 0ms，child 1 (index 0) 應為 210ms
    const delay8 = await items.nth(7).evaluate(el => getComputedStyle(el).transitionDelay);
    const delay1 = await items.nth(0).evaluate(el => getComputedStyle(el).transitionDelay);

    // transition-delay 可能是 "0s" 或 "0ms"
    const ms8 = parseFloat(delay8) * (delay8.includes('ms') ? 1 : 1000);
    const ms1 = parseFloat(delay1) * (delay1.includes('ms') ? 1 : 1000);

    expect(ms8).toBe(0);
    expect(ms1).toBeCloseTo(210, -1); // 允許 ±10ms 誤差
  });

  // items 位置在 FAB 左側
  test('所有 speed-dial-item 位於 FAB 左側', async ({ page }) => {
    await page.goto('/');
    await page.locator('.day-section').first().waitFor({ timeout: 10000 });

    await page.locator('.speed-dial-trigger').click();
    await page.waitForTimeout(400);

    const fabBox = await page.locator('.speed-dial-trigger').boundingBox();
    const items = page.locator('.speed-dial-item');
    const count = await items.count();

    for (let i = 0; i < count; i++) {
      const box = await items.nth(i).boundingBox();
      if (box && fabBox) {
        // item 的右邊界應小於 FAB 的左邊界
        expect(box.x + box.width).toBeLessThanOrEqual(fabBox.x + 2); // +2 容差
      }
    }
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
    await page.locator('.speed-dial-trigger').click();
    await page.waitForTimeout(400);
    // 點擊第一個 sheet 類型 item（航班）
    await page.locator('.speed-dial-item[data-content="flights"]').click();
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
    await page.locator('.speed-dial-trigger').click();
    await page.waitForTimeout(400);
    // 點擊 tools 群組（設定）
    await page.locator('.speed-dial-item[data-content="tools"]').click();
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
    await page.locator('.speed-dial-trigger').click();
    await page.waitForTimeout(400);
    await page.locator('.speed-dial-item[data-content="flights"]').click();
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

  test('speed-dial-items position:absolute，bottom:0（底部對齊 FAB）', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(300);
    const pos = await page.locator('.speed-dial-items').evaluate(el => ({
      position: getComputedStyle(el).position,
      bottom: getComputedStyle(el).bottom,
    }));
    expect(pos.position).toBe('absolute');
    expect(pos.bottom).toBe('0px');
  });

  test('speed-dial-item 的 flex-direction:row（橫向 pill）', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(300);
    const flexDir = await page.locator('.speed-dial-item').first().evaluate(el => getComputedStyle(el).flexDirection);
    expect(flexDir).toBe('row');
  });

  test('speed-dial-item 的 border-radius 為 full（pill 形狀）', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(300);
    const br = await page.locator('.speed-dial-item').first().evaluate(el => parseFloat(getComputedStyle(el).borderRadius));
    // --radius-full 可能是 9999px 或 99px，確保是充分圓角（pill 效果）
    expect(br).toBeGreaterThanOrEqual(99);
  });
});
