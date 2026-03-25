import { test, expect } from '@playwright/test';

/**
 * 驗證 CSS custom properties 在瀏覽器端正確定義 + 主題切換正常。
 * 這是 AB Test Blue-Green 方案的地基 — 此測試失敗則整個方案需重新評估。
 */

function expectColor(actual: string, expected: string) {
  expect(actual.toLowerCase()).toBe(expected.toLowerCase());
}

test.describe('tokens.css Layer 驗證', () => {

  test('CSS custom properties 正確定義（sun-light 預設主題）', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);

    const tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        accent: s.getPropertyValue('--color-accent').trim(),
        background: s.getPropertyValue('--color-background').trim(),
        foreground: s.getPropertyValue('--color-foreground').trim(),
        secondary: s.getPropertyValue('--color-secondary').trim(),
        radiusMd: s.getPropertyValue('--radius-md').trim(),
        spacing4: s.getPropertyValue('--spacing-4').trim(),
        fontSizeBody: s.getPropertyValue('--font-size-body').trim(),
        navH: s.getPropertyValue('--nav-h').trim(),
        tapMin: s.getPropertyValue('--tap-min').trim(),
      };
    });

    expectColor(tokens.accent, '#E86A4A');
    expectColor(tokens.background, '#FBF3E8');
    expectColor(tokens.foreground, '#2E2418');
    expectColor(tokens.secondary, '#F0DABC');
    expect(tokens.radiusMd).toBe('12px');
    expect(tokens.spacing4).toBe('16px');
    expect(tokens.fontSizeBody).toBe('1.0625rem');
    expect(tokens.navH).toBe('48px');
    expect(tokens.tapMin).toBe('44px');
  });

  test('深色模式 token 覆蓋正確', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);

    // 設定 dark class
    await page.evaluate(() => {
      document.body.classList.add('theme-sun', 'dark');
    });
    await page.waitForTimeout(200);

    // 分開讀取 computed style
    const tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return {
        accent: s.getPropertyValue('--color-accent').trim(),
        background: s.getPropertyValue('--color-background').trim(),
        foreground: s.getPropertyValue('--color-foreground').trim(),
      };
    });

    expectColor(tokens.accent, '#F4A08A');
    expectColor(tokens.background, '#1E1A16');
    expectColor(tokens.foreground, '#EAE2D6');
  });

  test('Sky 主題 token 覆蓋正確', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);

    // 切換 sky 主題
    await page.evaluate(() => {
      document.body.className = 'theme-sky';
    });
    await page.waitForTimeout(200);

    const tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return {
        accent: s.getPropertyValue('--color-accent').trim(),
        background: s.getPropertyValue('--color-background').trim(),
      };
    });

    expectColor(tokens.accent, '#2870A0');
    expectColor(tokens.background, '#FFF9F0');
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
