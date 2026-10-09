// @ts-check
/**
 * #1424：手機標題列的行程切換器、/add-to-trip 的錯誤狀態。
 *
 * 1. 長行程名稱時，切換器被標題框硬切：最後一個字只剩半個、沒有 `…`，下拉箭頭整個被切掉，
 *    使用者看不出這裡可以切換。根因：<h1> 內的 inline-flex 容器，shrink-to-fit 寬度的下限是
 *    內容的 min-content，而 white-space:nowrap 的文字 min-content 就是全文寬——
 *    overflow:hidden 只降低 flex 的「自動最小尺寸」，不降低容器的固有寬度。
 * 2. /add-to-trip 缺參數的錯誤狀態是裸文字加預設灰按鈕：錯誤區塊渲染在
 *    .tp-favorites-add-to-trip 容器外，而它的樣式只定義在容器內。
 *
 * 只驗瀏覽器實際算出的版面／樣式，不驗 CSS 字面。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

// 只在 chromium 專案跑：以固定 viewport 自行量版面；master CI 的 mobile-chrome／mobile-safari
// 矩陣不該為這些測試製造噪音（PR 只跑 chromium）。
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑'); });

const TRIP = 'okinawa-trip-2026-Ray';
const LONG = '2027圓夢之旅～滑雪藏王樹冰（超長行程名稱測試用，一定會超出標題框）';

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
  await page.route('**/api/route**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ polyline: [], duration: null, distance: 0, approx: true }),
  }));
});

/** 量標題框與切換器：箭頭是否在標題框可見範圍內、文字是否被省略。 */
async function measureTitle(page) {
  return page.evaluate(() => {
    const h1 = document.querySelector('.tp-titlebar-title');
    const chev = document.querySelector('.tp-titlebar-trip-title-chevron');
    const txt = document.querySelector('.tp-titlebar-trip-title-text');
    if (!h1 || !chev || !txt) return null;
    const h = h1.getBoundingClientRect();
    const c = chev.getBoundingClientRect();
    return {
      overflow: h1.scrollWidth - h1.clientWidth, // >0 = 內容被標題框裁掉
      chevronInside: c.right <= h.right + 0.5 && c.left >= h.left,
      truncated: txt.scrollWidth > txt.clientWidth,
      textOverflow: getComputedStyle(txt).textOverflow,
    };
  });
}

test('手機地圖頁：長行程名稱以省略號截斷，下拉箭頭仍可見、沒有內容被標題框裁掉', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/trip/${TRIP}/map?day=all`);
  const text = page.locator('.tp-titlebar-trip-title-text');
  await expect(text, '切換器（≥2 筆行程）應出現').toBeVisible();
  await text.evaluate((el, t) => { el.textContent = t; }, LONG);
  const m = await measureTitle(page);
  expect(m, '找不到標題框／切換器／箭頭').not.toBeNull();
  expect(m.overflow, '標題框內容溢出被硬切（沒有省略號）').toBeLessThanOrEqual(1);
  expect(m.chevronInside, '下拉箭頭被切到標題框外了 — 使用者看不出可以切換').toBe(true);
  expect(m.truncated, '超長標題應該被截斷').toBe(true);
  expect(m.textOverflow).toBe('ellipsis');
});

test('手機行程頁：長行程名稱同樣以省略號截斷、下拉箭頭可見（標題框較窄，旁邊還有操作鈕）', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/trip/${TRIP}`);
  const text = page.locator('.tp-titlebar-trip-title-text');
  await expect(text, '切換器（≥2 筆行程）應出現').toBeVisible();
  await text.evaluate((el, t) => { el.textContent = t; }, LONG);
  const m = await measureTitle(page);
  expect(m, '找不到標題框／切換器／箭頭').not.toBeNull();
  expect(m.overflow, '標題框內容溢出被硬切（沒有省略號）').toBeLessThanOrEqual(1);
  expect(m.chevronInside, '下拉箭頭被切到標題框外了').toBe(true);
  expect(m.truncated).toBe(true);
  expect(m.textOverflow).toBe('ellipsis');
});

test('手機地圖頁：短行程名稱時標題列不變（無溢出、箭頭可見、不截斷）', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/trip/${TRIP}/map?day=all`);
  const text = page.locator('.tp-titlebar-trip-title-text');
  await expect(text).toBeVisible();
  await text.evaluate((el) => { el.textContent = '沖繩'; });
  const m = await measureTitle(page);
  expect(m.overflow).toBeLessThanOrEqual(1);
  expect(m.chevronInside).toBe(true);
  expect(m.truncated).toBe(false);
});

for (const scheme of ['light', 'dark']) {
  test(`/add-to-trip 缺參數：錯誤狀態有樣式（置中卡片、品牌化的重試鈕）— ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/add-to-trip');
    const box = page.getByTestId('favorites-add-to-trip-load-error');
    await expect(box).toBeVisible();
    const s = await box.evaluate((el) => {
      const cs = getComputedStyle(el);
      const btn = el.querySelector('button');
      const bs = btn ? getComputedStyle(btn) : null;
      const br = btn ? btn.getBoundingClientRect() : null;
      return {
        textAlign: cs.textAlign, hasBorder: parseFloat(cs.borderTopWidth) > 0,
        btnHeight: br ? br.height : 0, btnRadius: bs ? parseFloat(bs.borderTopLeftRadius) : 0,
      };
    });
    expect(s.textAlign, '錯誤區塊應置中（同其他頁的錯誤卡片）').toBe('center');
    expect(s.hasBorder, '錯誤區塊應是有框的卡片，不是裸文字').toBe(true);
    expect(s.btnHeight, '重試鈕不應是瀏覽器預設的小按鈕（<44px 觸控目標）').toBeGreaterThanOrEqual(44);
    expect(s.btnRadius, '重試鈕應是膠囊樣式').toBeGreaterThanOrEqual(16);
  });
}

// 時間 chip（WCAG 2.2 的 2.5.8 目標尺寸，AA：24×24 CSS px）。
// 不靠 axe：axe 在鄰近目標夠遠時適用「間距例外」不報，mock 版面正好如此；真實資料下 chip 旁邊
// 緊貼其他目標才會報（2026-10 全頁擷圖驗證實測）。所以直接量尺寸，比 axe 嚴格但更不易假綠。
for (const [w, h] of [[390, 844], [768, 1024], [1440, 900]]) {
  test(`行程頁時間 chip 高度 ≥ 24px — ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`/trip/${TRIP}`);
    const chips = page.locator('[data-testid^="timeline-rail-time-chip"]');
    await expect(chips.first(), '行程頁應有時間 chip').toBeVisible();
    const heights = await chips.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(0);
    for (const hh of heights) expect(hh, `時間 chip 高 ${hh}px < 24px`).toBeGreaterThanOrEqual(24);
  });
}
