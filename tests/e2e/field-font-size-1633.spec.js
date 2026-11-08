// @ts-check
/**
 * 表單欄位字級守門（trip-planner#1633）：iOS Safari 對聚焦時字級 <16px 的文字欄位會自動放大畫面。
 * 在 390 寬掃每個頁面所有「可輸入文字」的 input／textarea／select（排除 checkbox／radio／button／hidden 等），
 * 量 computed font-size，要求 ≥16px。計算字級不等於真機驗證（iOS 是否仍放大須真機確認）。
 * 無法在 mock 下到達的欄位（需 hasPassword／OAuth 參數／>8 筆行程／可編輯的車程膠囊等特殊狀態）改由 tests/unit/field-font-size-1633.test.ts 靜態守。
 * MobileOnlyRoute 路由只在 ≤1023px 渲染，故用 390 寬。
 * 執行：npx playwright test tests/e2e/field-font-size-1633.spec.js --project=chromium
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

const TRIP = 'okinawa-trip-2026-Ray';

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
});

/**
 * @typedef {{ name: string, url: string, min?: number, stub?: (page: import('@playwright/test').Page) => Promise<void>, prepare?: (page: import('@playwright/test').Page) => Promise<void> }} Page1
 * @type {Page1[]}
 */
const PAGES = [
  { name: 'AddStop', url: `/trip/${TRIP}/add-stop?day=1` },
  { name: 'AddCustomStop', url: `/trip/${TRIP}/add-custom-stop?day=1` },
  { name: 'ChangePoi', url: `/trip/${TRIP}/stop/101/change-poi` },
  { name: 'ChangePoi 自訂', url: `/trip/${TRIP}/stop/101/change-poi?tab=custom` },
  { name: 'EditEntry', url: `/trip/${TRIP}/stop/101/edit` },
  { name: 'EditEntry POI 備註', url: `/trip/${TRIP}/stop/101/edit`,
    prepare: async (p) => { await p.getByTestId('edit-entry-poi-note-read-101').click(); } },
  { name: 'Collab', url: `/trip/${TRIP}/collab` },
  { name: 'Chat', url: `/chat?tripId=${TRIP}` },
  { name: 'Explore', url: '/explore' },
  { name: 'Favorites', url: '/favorites',
    prepare: async (p) => { await p.evaluate(() => fetch('/api/poi-favorites', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ poiId: 1 }) })); await p.reload(); } },
  { name: 'NewTrip', url: '/trips/new' },
  { name: 'EditTrip', url: `/trip/${TRIP}/edit` },
  { name: 'Login', url: '/login' },
  { name: 'Signup', url: '/signup' },
  { name: 'ForgotPassword', url: '/login/forgot' },
  { name: 'ResetPassword', url: '/auth/password/reset?token=x' },
  { name: 'Trip 時間軸 stop 備註（TimelineRail）', url: `/trips?selected=${TRIP}#day1`,
    prepare: async (p) => { await p.locator('[data-testid^=timeline-rail-toggle-]').first().click(); await p.locator('[data-testid^=timeline-rail-note-value-]').first().click(); } },
  { name: '行程選擇器搜尋框（>8 筆行程）', url: `/trips?selected=${TRIP}#day1`,
    stub: async (p) => {
      const trips = Array.from({ length: 10 }, (_, i) => ({ tripId: i === 0 ? TRIP : `demo-trip-${i}`, name: `範例行程 ${i}`, owner: 'Ray', title: `範例行程 ${i}`, role: 'owner', countries: '["JP"]', published: 1, lang: 'zh-TW', dataSource: 'manual' }));
      await p.route(/\/api\/my-trips$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(trips) }));
    },
    prepare: async (p) => { await p.locator('.tp-titlebar-trip-title').first().click(); } },
  { name: 'Explore InputModal', url: '/explore',
    prepare: async (p) => { await p.getByTestId('explore-region-pill').click(); await p.getByTestId('explore-region-option-custom').click(); } },
  { name: 'DeveloperAppNew', url: '/developer/apps/new' },
];

// 可輸入文字的欄位：排除 checkbox／radio／button／hidden 等非文字輸入（這些不觸發 iOS 聚焦放大）
const FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset]):not([type=image]):not([type=file]):not([type=hidden]):not([type=range]):not([type=color]), textarea, select';

for (const c of PAGES) {
  test(`${c.name}：所有可輸入文字欄位計算字級 ≥16px（390 寬）`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    if (process.env.SCHEME) await page.emulateMedia({ colorScheme: /** @type {'light'|'dark'} */ (process.env.SCHEME) });
    await setupApiMocks(page);
    await page.route(/maps\.googleapis\.com/, (r) => r.abort());
    await page.route('**/api/route**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ polyline: [], duration: null, distance: 0, approx: true }),
    }));
    if (c.stub) await c.stub(page);
    await page.goto(c.url);
    if (c.prepare) { await page.waitForLoadState('load'); await page.waitForTimeout(1500); await c.prepare(page); }
    if (c.min !== 0) await page.locator(FIELD).first().waitFor({ state: 'attached', timeout: 15000 });
    await page.waitForTimeout(500);
    const rows = await page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map((el) => ({
      tag: el.tagName.toLowerCase() + (el.getAttribute('type') ? `[type=${el.getAttribute('type')}]` : ''),
      cls: (el.getAttribute('class') || '').trim(),
      px: parseFloat(getComputedStyle(el).fontSize),
    })), FIELD);
    // 環境變數 SHOT_DIR：存截圖供人工看版面（SCHEME=dark 切深色）
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${process.env.SHOT_TAG || 'shot'}-${c.name.replace(/[^\w一-龥]+/g, '_')}.png` });
    for (const r of rows) console.log(`FIELD ${c.name} | ${r.tag}.${r.cls} | ${r.px}px`);
    const small = rows.filter((r) => r.px < 16).map((r) => `${r.tag}.${r.cls} ${r.px}px`);
    expect(small, `${c.name} 字級 <16px 的欄位`).toEqual([]);
  });
}
