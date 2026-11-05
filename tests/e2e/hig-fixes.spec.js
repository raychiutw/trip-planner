// @ts-check
/**
 * HIG 修正的行為守門（trip-planner#1571）：版面類的修正（量得到的幾何）。
 * 用 hig-scene-fixtures 的場景與 mock，量「修好之後該成立的事」，不是只截圖。
 * 執行：npx playwright test tests/e2e/hig-fixes.spec.js --project=chromium
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');
const { SCENES, setupSceneExtras } = require('./hig-scene-fixtures');

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
});

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

async function open(page, name, vp) {
  const scene = SCENES.find((s) => s.name === name);
  if (!scene) throw new Error(`沒有場景 ${name}`);
  await page.setViewportSize(vp);
  await setupApiMocks(page);
  await setupSceneExtras(page);
  if (scene.stub) await scene.stub(page);
  await page.goto(scene.path);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
}

// 發現 1：帳號子頁上方小標緊貼固定頁首（無間距、被壓住）
for (const name of ['account-sessions', 'account-connected-apps', 'developer-apps']) {
  for (const [vpName, vp] of [['手機', MOBILE], ['桌機', DESKTOP]]) {
    test(`小標不被固定頁首壓住：${name} · ${vpName}`, async ({ page }) => {
      await open(page, name, vp);
      const m = await page.evaluate(() => {
        const bar = document.querySelector('.tp-titlebar');
        const eyebrow = document.querySelector('.tp-page-eyebrow');
        if (!bar || !eyebrow) return null;
        return { barBottom: bar.getBoundingClientRect().bottom, eyebrowTop: eyebrow.getBoundingClientRect().top };
      });
      expect(m, '找不到 .tp-titlebar 或 .tp-page-eyebrow').not.toBeNull();
      expect(m.eyebrowTop - m.barBottom, '小標與固定頁首的間距（px）').toBeGreaterThanOrEqual(12);
    });
  }
}

// 發現 2：行程詳情桌機右側地圖面板錯誤態的「重試」要有專案按鈕樣式（不是原生灰色鈕）
test('地圖面板錯誤態的重試按鈕有專案樣式：trip-detail · 桌機', async ({ page }) => {
  await open(page, 'trip-detail', DESKTOP);
  const btn = page.getByRole('button', { name: '重試' }).first();
  await expect(btn).toBeVisible();
  // 與專案 destructive 實心鈕（.tp-btn-destructive.is-filled）的底色同一個 token，且不是原生灰
  const s = await btn.evaluate((el) => {
    const cs = getComputedStyle(el);
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--color-destructive)';
    document.body.appendChild(probe);
    const token = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { bg: cs.backgroundColor, token, radius: parseFloat(cs.borderTopLeftRadius), h: el.getBoundingClientRect().height };
  });
  expect(s.bg, '底色應為專案 destructive token').toBe(s.token);
  expect(s.bg, '原生按鈕底色是 rgb(239, 239, 239)').not.toBe('rgb(239, 239, 239)');
  expect(s.radius, '圓角').toBeGreaterThanOrEqual(6);
  expect(s.h, '觸控高度').toBeGreaterThanOrEqual(44);
});

// 發現 3：手機寬的移動方式膠囊不超出右緣
test('移動方式膠囊不超出視窗右緣：trip-detail · 手機', async ({ page }) => {
  await open(page, 'trip-detail', MOBILE);
  const rights = await page.evaluate(() =>
    [...document.querySelectorAll('.tp-travel-pill')].map((el) => Math.round(el.getBoundingClientRect().right)));
  expect(rights.length).toBeGreaterThan(0);
  for (const r of rights) expect(r, `膠囊右緣 ${r}px`).toBeLessThanOrEqual(MOBILE.width - 8);
});

// 發現 6：日期欄 placeholder 字級與同頁其他 placeholder 一致，且有值／無值的欄高相同
test('日期欄「選擇日期」字級與同頁 placeholder 一致、欄高不因有無值而不同：trips-new · 手機', async ({ page }) => {
  await open(page, 'trips-new', MOBILE);
  const m = await page.evaluate(() => {
    const ph = document.querySelector('.tp-date-value.is-placeholder');
    const ta = document.querySelector('textarea');
    return {
      datePh: ph ? parseFloat(getComputedStyle(ph).fontSize) : null,
      otherPh: ta ? parseFloat(getComputedStyle(ta, '::placeholder').fontSize) : null,
    };
  });
  expect(m.datePh).not.toBeNull();
  expect(m.datePh, '日期 placeholder 字級應等於同頁其他 placeholder').toBe(m.otherPh);
});

// 同上：選了日期之後，有值與無值兩欄的高度要一致（v2.33.120 修過的落差，不能因為縮小 placeholder 而回來）。
// 手機寬 390 時日期值本身會折成兩行（另一個既有問題，不在本票範圍），所以用桌機寬量。
test('日期欄有值與無值的欄高一致：trips-new · 桌機', async ({ page }) => {
  await open(page, 'trips-new', DESKTOP);
  const h = async (sel) => (await page.locator(sel).boundingBox()).height;
  const before = await h('#new-trip-end');
  await page.locator('#new-trip-start').click();
  await page.locator('.tp-date-popover .rdp-day_button:not([disabled])').nth(10).click();
  expect(await h('#new-trip-start'), '有值欄高').toBe(before);
  expect(await h('#new-trip-end'), '無值欄高').toBe(before);
});

// 發現：探索頁「搜尋」鈕在非 Apple 字型（Linux／Android）下，輸入框預設寬度把它擠窄，
// 文字直排成「搜／尋」兩行（47x60），而 macOS 上是 62x38（高度不到 44）。
// 兩種環境都該是單行、≥ 44x44。
test('探索頁搜尋鈕單行且至少 44x44', async ({ page }) => {
  await open(page, 'explore', MOBILE);
  const m = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="explore-search-submit"]');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(btn);
    const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
    return { w: r.width, h: r.height, lines };
  });
  expect(m, '找不到搜尋鈕').not.toBeNull();
  expect(m.lines, '搜尋鈕文字換行').toBe(1);
  expect(Math.min(m.w, m.h), `搜尋鈕 ${m.w}x${m.h}`).toBeGreaterThanOrEqual(44);
});

// ── #1587 彈出層修正的版面守門 ────────────────────────────────────────────

/** 跑場景自己的 act（例如送出表單、觸發離線事件）。 */
async function actOf(page, name) {
  const scene = SCENES.find((s) => s.name === name);
  await scene.act(page);
}

// 13：離線橫幅納入 app-shell 版面，不在 100dvh 之外多佔高度、整頁不出現捲軸
for (const [vpName, vp] of [['手機', MOBILE], ['桌機', DESKTOP]]) {
  test(`離線橫幅不增加整頁高度、shell 不被擠出視窗：${vpName}`, async ({ page }) => {
    await open(page, 'popup-server-status-banner', vp);
    const measure = () => page.evaluate(() => {
      const shell = document.querySelector('.app-shell');
      const r = shell.getBoundingClientRect();
      return { scrollHeight: document.documentElement.scrollHeight, inner: innerHeight, top: r.top, bottom: r.bottom };
    });
    const before = await measure();
    await actOf(page, 'popup-server-status-banner');
    await expect(page.getByTestId('server-status-banner')).toBeVisible({ timeout: 6000 });
    await page.waitForTimeout(200);
    const after = await measure();
    expect(after.scrollHeight, '離線前後整頁高度').toBe(before.scrollHeight);
    expect(after.scrollHeight, '整頁高度不超過視窗').toBeLessThanOrEqual(after.inner);
    expect(after.bottom, 'shell 下緣不超出視窗').toBeLessThanOrEqual(after.inner + 1);
  });
}

// 15：Toast 位置照 DESIGN.md「Error & Status Messaging」
test('Toast 位置：手機在底部且高於 bottom nav', async ({ page }) => {
  await open(page, 'popup-toast-error', MOBILE);
  await actOf(page, 'popup-toast-error');
  const toast = page.locator('.tp-toast').first();
  await expect(toast).toBeVisible();
  const r = await toast.boundingBox();
  const nav = await page.evaluate(() => document.querySelector('.app-shell-bottom-nav, [data-testid="global-bottom-nav"]')?.getBoundingClientRect().top ?? null);
  expect(r.y, 'Toast 在視窗下半').toBeGreaterThan(MOBILE.height / 2);
  if (nav !== null) expect(r.y + r.height, 'Toast 下緣高於 bottom nav 上緣').toBeLessThanOrEqual(nav);
});

test('Toast 位置：桌機在右上、titlebar 下方', async ({ page }) => {
  await open(page, 'popup-toast-error', DESKTOP);
  await actOf(page, 'popup-toast-error');
  const toast = page.locator('.tp-toast').first();
  await expect(toast).toBeVisible();
  const r = await toast.boundingBox();
  const titlebarH = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--titlebar-h')));
  expect(r.y, 'Toast 上緣在 titlebar 下方').toBeGreaterThanOrEqual(titlebarH);
  expect(DESKTOP.width - (r.x + r.width), 'Toast 靠右').toBeLessThanOrEqual(32);
});

// 19：手機寬有效期限分段控制不折行
test('分享對話框有效期限五個選項同一列：手機', async ({ page }) => {
  await open(page, 'popup-share-link-modal', MOBILE);
  await SCENES.find((s) => s.name === 'popup-share-link-modal').act(page);
  const tops = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="share-expiry-"]')].map((b) => Math.round(b.getBoundingClientRect().top)));
  expect(tops).toHaveLength(5);
  expect(new Set(tops).size, `各選項上緣 ${tops}`).toBe(1);
});
