/**
 * AI 聊天輸入列的玻璃（owner 選 A3：不透明度 55%、模糊 24px）。
 *
 * 原本是 92% 不透明＋blur(14px)：玻璃技術上存在，但只透出 8%，看起來和實心一樣。
 * 看 computed style 而不是原始碼：同一個 token 在瀏覽器端可能被降級或蓋掉（見 glass-degrade.spec.js）。
 * 輸入框本身維持實心底色（文字可讀性不受透明度影響）。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

for (const scheme of ['light', 'dark']) {
  test(`chat composer glass is visibly translucent · ${scheme}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
    await page.emulateMedia({ colorScheme: scheme });
    await setupApiMocks(page);
    await page.route('**/api/account/ai-authorization', (r) => r.fulfill({ json: { authorized: true } }));
    await page.goto('/chat');
    const composer = page.locator('.tp-chat-composer');
    await expect(composer).toBeVisible();
    const s = await composer.evaluate((el) => {
      const cs = getComputedStyle(el);
      const input = getComputedStyle(document.querySelector('.tp-chat-input'));
      return { filter: cs.backdropFilter, bg: cs.backgroundColor, inputBg: input.backgroundColor, inputFilter: input.backdropFilter };
    });
    expect(s.filter).toBe('blur(24px)');
    const alpha = Number(/\/\s*([\d.]+)\)/.exec(s.bg)?.[1]);
    expect(alpha, `輸入列底色 ${s.bg}`).toBeGreaterThan(0.5);
    expect(alpha, `輸入列底色 ${s.bg}`).toBeLessThan(0.6);
    // 輸入框本身是實心：沒有 alpha 通道（rgb(...)），文字可讀性不受影響
    expect(s.inputBg, '輸入框維持實心底色').toMatch(/^rgb\(/);
  });
}
