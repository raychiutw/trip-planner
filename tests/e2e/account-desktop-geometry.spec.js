// @ts-check
/**
 * 帳號頁桌機版面 A 與側邊欄 B 的「量得到」守門（#1688／#1689 code-review）。
 * jsdom 不計算 CSS，單元測試只能擋 CSS 字串；這裡用真瀏覽器量幾何：
 * 個人卡與設定格左右邊緣對齊、容器固定約 1040 且 1440／1920 同寬、側邊欄 216px、1024 個人卡不換行、手機版不變。
 * 設 SHOTS_DIR 時另外截圖（供人工檢視，不是斷言）。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

const TRIP_ID = 'okinawa-trip-2026-Ray';
const EPS = 1.5;

/** @param {import('@playwright/test').Page} page */
async function measure(page, skipGoto = false) {
  if (!skipGoto) await page.goto('/account');
  await page.getByTestId('account-hero').waitFor();
  await page.getByTestId('account-hero').getByText('個行程').waitFor();
  await page.waitForLoadState('networkidle');
  return page.evaluate(() => {
    /** @param {Element | null} e */
    const r = (e) => { const b = e?.getBoundingClientRect(); return b ? { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width } : null; };
    return {
      inner: r(document.querySelector('.tp-account-inner')),
      hero: r(document.querySelector('[data-testid="account-hero"]')),
      avatar: r(document.querySelector('.tp-account-hero-avatar')),
      text: r(document.querySelector('.tp-account-hero-text')),
      stats: r(document.querySelector('.tp-account-hero-stats')),
      rows: [...document.querySelectorAll('[data-testid^="account-rows-"]')].map((e) => r(e)),
      sidebar: r(document.querySelector('[data-testid="desktop-sidebar"]')),
      shellClientWidth: document.querySelector('.tp-account-shell')?.clientWidth ?? 0,
      heroDirection: getComputedStyle(/** @type {Element} */ (document.querySelector('[data-testid="account-hero"]'))).flexDirection,
    };
  });
}

test.describe('帳號頁桌機版面 A／側邊欄 B 幾何', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', '寬度由本檔自行設定，只需跑桌機專案');
    await setupApiMocks(page);
  });

  /** @type {Record<number, number>} */
  const innerWidths = {};
  for (const width of [1440, 1920]) {
    test(`${width}px：個人卡與設定格左右邊緣對齊、容器約 1040、側邊欄 216`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const m = await measure(page);
      expect(m.rows.length).toBe(3);
      for (const row of m.rows) {
        expect(Math.abs(row.left - m.hero.left), `設定格左緣 ${row.left} vs 個人卡 ${m.hero.left}`).toBeLessThan(EPS);
        expect(Math.abs(row.right - m.hero.right), `設定格右緣 ${row.right} vs 個人卡 ${m.hero.right}`).toBeLessThan(EPS);
      }
      expect(Math.abs(m.inner.width - 1040), `容器寬 ${m.inner.width}`).toBeLessThan(EPS);
      expect(m.heroDirection, '個人卡應為橫式（桌機版面 A）').toBe('row');
      expect(m.stats.left, '統計在文字右側').toBeGreaterThanOrEqual(m.text.right - EPS);
      expect(Math.abs(m.sidebar.width - 216), `側邊欄寬 ${m.sidebar.width}`).toBeLessThan(EPS);
      innerWidths[width] = m.inner.width;
      if (innerWidths[1440] && innerWidths[1920]) expect(Math.abs(innerWidths[1440] - innerWidths[1920])).toBeLessThan(EPS);
    });
  }

  test('1024px：容器填滿可用寬度、個人卡與設定格同寬、個人卡橫式不換行', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    // #1708：<1200 側欄預設收合；本案要量「側欄展開時」的 1024 版面，先展開並等 220ms 欄寬過場結束
    await page.goto('/account');
    await page.getByRole('button', { name: '顯示側欄' }).last().click();
    await expect.poll(async () => (await page.getByTestId('desktop-sidebar').boundingBox())?.width).toBeCloseTo(216, 0);
    const m = await measure(page, true);
    expect(Math.abs(m.sidebar.width - 216)).toBeLessThan(EPS);
    // 填滿捲動容器的可視寬（扣掉 216px 側邊欄；捲軸寬度因平台而異，所以以 clientWidth 為準）
    expect(m.shellClientWidth).toBeGreaterThan(1024 - 216 - 20);
    expect(Math.abs(m.inner.width - m.shellClientWidth), `容器寬 ${m.inner.width}`).toBeLessThan(EPS);
    for (const row of m.rows) {
      expect(Math.abs(row.left - m.hero.left)).toBeLessThan(EPS);
      expect(Math.abs(row.right - m.hero.right)).toBeLessThan(EPS);
    }
    expect(m.heroDirection).toBe('row');
    // 沒換行：頭像、文字、統計落在同一橫列，統計在文字右邊
    expect(m.stats.left, '統計在文字右側（沒有換行到下一列）').toBeGreaterThanOrEqual(m.text.right - EPS);
    expect(m.stats.top).toBeLessThan(m.avatar.bottom);
    expect(m.hero.bottom - m.hero.top, '個人卡高度不應因換行而暴增').toBeLessThan(160);
  });

  test('手機 390px：沒有側邊欄、個人卡直式、設定格填滿同寬', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const m = await measure(page);
    expect(m.heroDirection).toBe('column');
    expect(await page.getByTestId('desktop-sidebar').isVisible()).toBe(false);
    for (const row of m.rows) {
      expect(Math.abs(row.left - m.hero.left)).toBeLessThan(EPS);
      expect(Math.abs(row.right - m.hero.right)).toBeLessThan(EPS);
    }
  });

  const SHOTS = process.env.SHOTS_DIR;
  for (const scheme of /** @type {const} */ (['light', 'dark'])) {
    for (const width of [1024, 1440, 390]) {
      test(`截圖 ${scheme} ${width}`, async ({ page }) => {
        test.skip(!SHOTS, '設 SHOTS_DIR 才截圖');
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
        for (const [name, path] of [['account', '/account'], ['chat', '/chat'], ['trip', `/trip/${TRIP_ID}`]]) {
          await page.goto(path);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${SHOTS}/${name}-${scheme}-${width}.png` });
        }
      });
    }
  }
});
