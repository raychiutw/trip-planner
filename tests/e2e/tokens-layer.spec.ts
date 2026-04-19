import { test, expect } from '@playwright/test';

/**
 * 驗證 CSS custom properties 在瀏覽器端正確定義 + 主題切換正常。
 * 這是 AB Test Blue-Green 方案的地基 — 此測試失敗則整個方案需重新評估。
 */

function expectColor(actual: string, expected: string) {
  expect(actual.toLowerCase()).toBe(expected.toLowerCase());
}

test.describe('tokens.css Layer 驗證', () => {

  test('CSS custom properties 正確定義（Ocean 預設主題）', async ({ page }) => {
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

    expectColor(tokens.accent, '#0077B6');
    expectColor(tokens.background, '#FFFFFF');
    expectColor(tokens.foreground, '#222222');
    expect(tokens.radiusMd).toBe('8px');
    expect(tokens.spacing4).toBe('16px');
    expect(tokens.fontSizeBody).toBe('1.0625rem');
  });

  test('深色模式 Ocean deep-navy 覆蓋正確', async ({ page }) => {
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

    expectColor(tokens.accent, '#48CAE4');
    expectColor(tokens.background, '#0D1B2A');
    expectColor(tokens.foreground, '#E0F4FA');
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
});
