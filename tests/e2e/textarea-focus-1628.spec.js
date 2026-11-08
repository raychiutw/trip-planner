// @ts-check
/**
 * AddCustomStopPage 備註 textarea 焦點（trip-planner#1628）：鍵盤 Tab 進 textarea 要有可見焦點外框，
 * 對比 ≥3:1，字級 ≥16px（iOS Safari 聚焦不自動放大）。jsdom 不計算 CSS，所以用真瀏覽器量。
 * 此路由只在 ≤1023px 渲染（MobileOnlyRoute），故用 390 寬。
 * 執行：npx playwright test tests/e2e/textarea-focus-1628.spec.js --project=chromium
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
});

for (const scheme of ['light', 'dark']) {
  test(`備註 textarea Tab 後有焦點外框、字級 ≥16px：${scheme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: /** @type {'light'|'dark'} */ (scheme) });
    await setupApiMocks(page);
    await page.goto('/trip/okinawa-trip-2026-Ray/add-custom-stop?day=1');
    const note = page.getByTestId('add-custom-stop-note');
    await expect(note).toBeVisible();
    // 從 textarea 前一個可聚焦元素逐步 Tab 到它（真鍵盤路徑，:focus-visible 才成立）
    await page.getByTestId('add-custom-stop-title').focus();
    for (let i = 0; i < 30 && !(await note.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(note).toBeFocused();
    const m = await note.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        fontSize: parseFloat(cs.fontSize),
        outlineStyle: cs.outlineStyle, outlineWidth: parseFloat(cs.outlineWidth), outlineColor: cs.outlineColor,
        boxShadow: cs.boxShadow, bg: getComputedStyle(document.body).backgroundColor,
      };
    });
    const sp = process.env.SHOT_DIR;
    if (sp) await note.scrollIntoViewIfNeeded(), await page.screenshot({ path: `${sp}/${process.env.SHOT_TAG || 'shot'}-${scheme}.png` });
    console.log(JSON.stringify({ scheme, ...m }));
    expect.soft(m.fontSize, 'textarea 計算字級（px）').toBeGreaterThanOrEqual(16);
    expect(m.outlineStyle !== 'none' && m.outlineWidth >= 2, `焦點外框：${JSON.stringify(m)}`).toBe(true);
    const ratio = await page.evaluate(([fg, bg]) => {
      const p = (/** @type {string} */ s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const L = (/** @type {number[]} */ c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const a = L(p(fg)), b = L(p(bg));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }, [m.outlineColor, m.bg]);
    console.log(`contrast ${scheme}: ${ratio.toFixed(2)}`);
    expect(ratio, '焦點色對底色對比').toBeGreaterThanOrEqual(3);
  });
}
