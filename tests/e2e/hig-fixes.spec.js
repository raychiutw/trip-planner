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
  const s = await btn.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, radius: parseFloat(cs.borderTopLeftRadius), h: el.getBoundingClientRect().height };
  });
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
