import { test, expect } from '@playwright/test';

/**
 * 驗證 CSS custom properties 在瀏覽器端正確定義 + light/dark 切換正常。
 * 這是 AB Test Blue-Green 方案的地基 — 此測試失敗則整個方案需重新評估。
 */

function expectColor(actual: string, expected: string) {
  expect(actual.toLowerCase()).toBe(expected.toLowerCase());
}

test.describe('tokens.css Layer 驗證', () => {

  test('CSS custom properties 正確定義（Terracotta 預設主題）', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);

    const tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        accent: s.getPropertyValue('--color-accent').trim(),
        background: s.getPropertyValue('--color-background').trim(),
        foreground: s.getPropertyValue('--color-foreground').trim(),
        radiusMd: s.getPropertyValue('--radius-md').trim(),
        spacing4: s.getPropertyValue('--spacing-4').trim(),
        fontSizeBody: s.getPropertyValue('--font-size-body').trim(),
      };
    });

    expectColor(tokens.accent, '#A97A4A');
    expectColor(tokens.background, '#FFFBF5');
    expectColor(tokens.foreground, '#2A1F18');
    expect(tokens.radiusMd).toBe('8px');
    expect(tokens.spacing4).toBe('16px');
    expect(tokens.fontSizeBody).toBe('1rem'); // mockup-parity-qa-fixes: 17→16px (mockup body 規範)
  });

  test('深色模式 V3 中性深灰覆蓋正確', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      document.body.classList.add('dark');
    });
    await page.waitForTimeout(200);

    const tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return {
        accent: s.getPropertyValue('--color-accent').trim(),
        background: s.getPropertyValue('--color-background').trim(),
        foreground: s.getPropertyValue('--color-foreground').trim(),
      };
    });

    expectColor(tokens.accent, '#CBA06E');
    expectColor(tokens.background, '#1C1C1E');
    expectColor(tokens.foreground, '#F5F5F7');
  });

  test('Tailwind utilities layer 存在', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const hasUtilitiesLayer = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules);
          for (const rule of rules) {
            if (rule instanceof CSSLayerBlockRule && rule.name === 'utilities') {
              return true;
            }
          }
        } catch { /* cross-origin */ }
      }
      return false;
    });

    expect(hasUtilitiesLayer).toBe(true);
  });

  /* 落地頁插畫的 fill/stroke 全用 var() 上色。變數沒定義時瀏覽器不報錯，只會把顏色算成
   * none —— v2.57.0 起 --d1..--d4 從沒定義，hero 四個停留點與兩張卡的插畫在 prod 隱形兩個月，
   * 原始碼層的測試（只驗「有用 var」）一路全綠。所以這裡驗的是 build 產物在瀏覽器裡算出來的顏色。 */
  test('落地頁插畫引用的 var() 在淺色／深色都解得出顏色', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('landing-page').waitFor();

    const unresolved = () => page.evaluate(() => {
      const bad: string[] = [];
      for (const el of document.querySelectorAll('[data-testid="landing-page"] svg *')) {
        for (const prop of ['fill', 'stroke'] as const) {
          const attr = el.getAttribute(prop);
          if (attr?.includes('var(') && getComputedStyle(el)[prop] === 'none') {
            bad.push(`<${el.tagName} ${prop}="${attr}">`);
          }
        }
      }
      return bad;
    });

    expect(await unresolved(), '淺色').toEqual([]);
    await page.evaluate(() => document.body.classList.add('dark'));
    expect(await unresolved(), '深色').toEqual([]);
  });
});
