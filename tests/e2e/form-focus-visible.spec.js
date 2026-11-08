// @ts-check
/**
 * 表單欄位鍵盤焦點外框一致性（#1595 搜尋框、#1628 textarea 的統一寫法）。
 * 用真鍵盤 Tab 進欄位（:focus-visible 才成立），量 computed outline：樣式非 none、寬度 ≥2px、
 * 對底色對比 ≥3:1；同時記錄欄位字級（iOS 聚焦自動放大門檻 16px，不足只回報不擋）。
 * 淺／深色各跑一次。MobileOnlyRoute 路由只在 ≤1023px 渲染，故全部用 390 寬。
 * 無法在 mock 下到達的欄位（需特殊狀態）不在這裡，只由 tests/unit/focus-visible-consistency.test.ts 守。
 * 執行：npx playwright test tests/e2e/form-focus-visible.spec.js --project=chromium
 * 環境變數：SHOT_DIR（存截圖）、SHOT_TAG（檔名前綴）。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

const TRIP = 'okinawa-trip-2026-Ray';

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
});

/**
 * @typedef {{ name: string, url: string, field: string, ring?: string,
 *   prepare?: (page: import('@playwright/test').Page) => Promise<void> }} Case
 * field：要 Tab 到的欄位；ring：外框畫在容器時，用 closest 找容器（預設量欄位本身）。
 * @type {Case[]}
 */
const CASES = [
  { name: 'AddStop 搜尋框', url: `/trip/${TRIP}/add-stop?day=1`, field: '.tp-add-stop-search-input' },
  { name: 'ChangePoi 搜尋框', url: `/trip/${TRIP}/stop/101/change-poi`, field: '.tp-change-poi-search input' },
  { name: 'CustomPoiForm input（ChangePoi 自訂）', url: `/trip/${TRIP}/stop/101/change-poi?tab=custom`, field: '.tp-custom-poi-form-field input' },
  { name: 'EditEntry 說明 textarea', url: `/trip/${TRIP}/stop/101/edit`, field: '.tp-edit-entry-desc-input' },
  { name: 'Collab 邀請輸入', url: `/trip/${TRIP}/collab`, field: '.tp-collab-add-input' },
  { name: 'Chat 輸入框', url: `/chat?tripId=${TRIP}`, field: '.tp-chat-input' },
  { name: 'Explore 搜尋框', url: '/explore', field: '.explore-search input', ring: '.explore-search' },
  { name: 'Favorites 搜尋框', url: '/favorites', field: '.favorites-search input', ring: '.favorites-search',
    // 空收藏不會顯示搜尋框：先對 mock 建一筆收藏再重載
    prepare: async (p) => { await p.evaluate(() => fetch('/api/poi-favorites', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ poiId: 1 }) })); await p.reload(); } },
  { name: 'NewTrip 欄位', url: '/trips/new', field: '.tp-new-form-row input[type="text"], .tp-new-form-row textarea' },
  { name: 'EditTrip 文字欄位', url: `/trip/${TRIP}/edit`, field: '.tp-edit-row input[type="text"]' },
  { name: 'EditTrip TripSelect trigger', url: `/trip/${TRIP}/edit`, field: '.tp-select-trigger' },
  { name: 'NewTrip TripDatePicker trigger', url: '/trips/new', field: '.tp-date-trigger' },
  { name: 'EditEntry TripTimePicker trigger', url: `/trip/${TRIP}/stop/101/edit`, field: '.tp-time-trigger' },
  { name: 'EditEntry POI 備註 textarea', url: `/trip/${TRIP}/stop/101/edit`, field: '.tp-poi-note-input',
    prepare: async (p) => { await p.getByTestId('edit-entry-poi-note-read-101').click(); } },
  { name: 'Login 表單欄位（.tp-form-row）', url: '/login', field: '.tp-form-row > input' },
];

for (const scheme of ['light', 'dark']) {
  for (const c of CASES) {
    test(`${c.name} 鍵盤 Tab 後有焦點外框：${scheme}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: /** @type {'light'|'dark'} */ (scheme) });
      await setupApiMocks(page);
      // trip shell 會掛 sticky map；擋掉 Google 並回空 route，與 CI 同條件
      await page.route(/maps\.googleapis\.com/, (r) => r.abort());
      await page.route('**/api/route**', (r) => r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ polyline: [], duration: null, distance: 0, approx: true }),
      }));
      await page.goto(c.url);
      const field = page.locator(c.field).first();
      if (c.prepare) { await page.waitForLoadState('networkidle'); await c.prepare(page); }
      await field.waitFor({ state: 'visible', timeout: 15000 });
      // 從頁首開始真的按 Tab，直到焦點落在目標欄位
      await page.evaluate(() => { /** @type {HTMLElement|null} */ (document.activeElement)?.blur(); window.scrollTo(0, 0); });
      let reached = false;
      for (let i = 0; i < 150 && !reached; i++) {
        await page.keyboard.press('Tab');
        reached = await page.evaluate((sel) => !!document.activeElement?.matches(sel), c.field);
      }
      expect(reached, `Tab 150 次內沒到達 ${c.field}`).toBe(true);
      await page.waitForTimeout(300); // 等 transition（120–160ms）
      const m = await page.evaluate(([sel, ring]) => {
        const el = /** @type {HTMLElement} */ (document.activeElement);
        const box = ring ? /** @type {HTMLElement} */ (el.closest(ring)) : el;
        const cs = getComputedStyle(box);
        return {
          fontSize: parseFloat(getComputedStyle(el).fontSize),
          outlineStyle: cs.outlineStyle, outlineWidth: parseFloat(cs.outlineWidth), outlineColor: cs.outlineColor,
          boxShadow: cs.boxShadow, borderColor: cs.borderTopColor,
          bg: getComputedStyle(document.body).backgroundColor,
        };
      }, [c.field, c.ring ?? '']);
      const sp = process.env.SHOT_DIR;
      if (sp) {
        await page.locator(':focus').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${sp}/${process.env.SHOT_TAG || 'shot'}-${c.name.replace(/[^\w一-龥]+/g, '_')}-${scheme}.png` });
      }
      console.log('FOCUSMETRIC ' + JSON.stringify({ name: c.name, scheme, ...m }));
      // 字級 <16px 只回報（範圍外不改），不擋測試
      if (m.fontSize < 16) test.info().annotations.push({ type: 'font<16', description: `${c.name} ${m.fontSize}px` });
      expect(m.outlineStyle !== 'none' && m.outlineWidth >= 2, `焦點外框：${JSON.stringify(m)}`).toBe(true);
      const ratio = await page.evaluate(([fg, bg]) => {
        const p = (/** @type {string} */ s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const L = (/** @type {number[]} */ col) => { const [r, g, b] = col.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const a = L(p(fg)), b = L(p(bg));
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }, [m.outlineColor, m.bg]);
      expect(ratio, '焦點色對底色對比').toBeGreaterThanOrEqual(3);
    });
  }
}
