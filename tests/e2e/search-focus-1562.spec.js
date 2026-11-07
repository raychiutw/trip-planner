// @ts-check
/**
 * TripsListPage 搜尋框焦點（trip-planner#1562）：鍵盤 Tab 進搜尋框時，外層容器要有可見焦點樣式，
 * 且輸入框字級 ≥16px（iOS Safari 聚焦不自動放大）。jsdom 不計算 CSS，所以用真瀏覽器量。
 * 執行：npx playwright test tests/e2e/search-focus-1562.spec.js --project=chromium
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
});

for (const [vpName, vp] of [['手機 390', { width: 390, height: 844 }], ['桌機', { width: 1280, height: 800 }]]) {
  for (const scheme of ['light', 'dark']) {
    test(`搜尋框 Tab 後容器有焦點樣式、字級 ≥16px：${vpName} · ${scheme}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.emulateMedia({ colorScheme: /** @type {'light'|'dark'} */ (scheme) });
      await setupApiMocks(page);
      await page.goto('/trips');
      await page.getByTestId('trips-list-search-toggle').click();
      const input = page.getByTestId('trips-list-search-input');
      await expect(input).toBeFocused();
      // 從輸入框 Shift+Tab 再 Tab 回來 = 真的用鍵盤 Tab 進搜尋框
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(input).toBeFocused();
      await page.waitForTimeout(300); // 等膠囊展開動畫（width 160ms）
      const m = await input.evaluate((el) => {
        const box = /** @type {HTMLElement} */ (el.closest('.tp-trips-search'));
        const cs = getComputedStyle(box);
        return {
          fontSize: parseFloat(getComputedStyle(el).fontSize),
          outlineStyle: cs.outlineStyle, outlineWidth: parseFloat(cs.outlineWidth), outlineColor: cs.outlineColor,
          boxShadow: cs.boxShadow, bg: getComputedStyle(document.body).backgroundColor,
        };
      });
      const sp = process.env.SHOT_DIR;
      if (sp) await page.screenshot({ path: `${sp}/${process.env.SHOT_TAG || 'shot'}-${vpName.replace(' ', '')}-${scheme}.png` });
      console.log(JSON.stringify({ vpName, scheme, ...m }));
      expect.soft(m.fontSize, 'input 計算字級（px）').toBeGreaterThanOrEqual(16);
      const visible = (m.outlineStyle !== 'none' && m.outlineWidth >= 2) || m.boxShadow !== 'none';
      expect.soft(visible, `容器焦點樣式：${JSON.stringify(m)}`).toBe(true);
      // 對比 ≥3:1：焦點色對頁面底色
      const ratio = await page.evaluate(([fg, bg]) => {
        const p = (/** @type {string} */ s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const L = (/** @type {number[]} */ c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const a = L(p(fg)), b = L(p(bg));
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }, [m.outlineColor, m.bg]);
      console.log(`contrast ${scheme}: ${ratio.toFixed(2)}`);
      if (m.outlineStyle !== 'none') expect(ratio, '焦點色對底色對比').toBeGreaterThanOrEqual(3);
    });
  }
}
