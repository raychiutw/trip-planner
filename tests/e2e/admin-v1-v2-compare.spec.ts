import { test, expect } from '@playwright/test';

/**
 * AdminPage V1 vs V2 視覺比對。
 * V1: /admin（預設）
 * V2: /admin?v2=1
 *
 * 需要 vite preview 作為 webServer（playwright.config.js 已配置）。
 */
test.describe('AdminPage V1 vs V2 比對', () => {

  test('V1 頁面正常渲染', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // V1 用 admin- CSS class
    const hasAdminClass = await page.evaluate(() => {
      return !!document.querySelector('[class*="admin-"]');
    });
    expect(hasAdminClass).toBe(true);

    // 標題存在
    await expect(page.locator('text=權限管理')).toBeVisible();
  });

  test('V2 頁面正常渲染（無 admin- CSS class）', async ({ page }) => {
    await page.goto('/v2.html#/admin');
    await page.waitForLoadState('networkidle');

    // V2 不用 admin- CSS class
    const hasAdminClass = await page.evaluate(() => {
      return !!document.querySelector('[class*="admin-"]');
    });
    expect(hasAdminClass).toBe(false);

    // 標題存在
    await expect(page.locator('text=權限管理')).toBeVisible();
  });

  test('V2 頁面結構完整（標題、select、表單）', async ({ page }) => {
    await page.goto('/v2.html#/admin');
    await page.waitForLoadState('networkidle');

    // 標題
    await expect(page.locator('text=權限管理')).toBeVisible();

    // Close button
    await expect(page.locator('[aria-label="關閉"]')).toBeVisible();

    // Trip select
    await expect(page.locator('[aria-label="選擇行程"]')).toBeVisible();

    // Section titles（用 exact match 避免配對到 option 和 empty state）
    await expect(page.getByText('選擇行程', { exact: true })).toBeVisible();
    await expect(page.getByText('已授權成員', { exact: true })).toBeVisible();
    await expect(page.getByText('新增成員', { exact: true })).toBeVisible();

    // Email input
    await expect(page.locator('[placeholder="email@example.com"]')).toBeVisible();

    // Add button
    await expect(page.locator('button:text("新增")')).toBeVisible();

    // Empty state
    await expect(page.locator('text=請先選擇行程')).toBeVisible();
  });

  test('V1 和 V2 的 CSS token 值一致', async ({ page }) => {
    // V1
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const v1Tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return {
        accent: s.getPropertyValue('--color-accent').trim(),
        background: s.getPropertyValue('--color-background').trim(),
        foreground: s.getPropertyValue('--color-foreground').trim(),
      };
    });

    // V2
    await page.goto('/v2.html#/admin');
    await page.waitForLoadState('networkidle');

    const v2Tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return {
        accent: s.getPropertyValue('--color-accent').trim(),
        background: s.getPropertyValue('--color-background').trim(),
        foreground: s.getPropertyValue('--color-foreground').trim(),
      };
    });

    expect(v1Tokens.accent.toLowerCase()).toBe(v2Tokens.accent.toLowerCase());
    expect(v1Tokens.background.toLowerCase()).toBe(v2Tokens.background.toLowerCase());
    expect(v1Tokens.foreground.toLowerCase()).toBe(v2Tokens.foreground.toLowerCase());
  });

  test('V2 使用 Tailwind arbitrary values', async ({ page }) => {
    await page.goto('/v2.html#/admin');
    await page.waitForLoadState('networkidle');

    const hasTailwindArbitrary = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      for (const el of all) {
        if (el.className && typeof el.className === 'string' && el.className.includes('var(--')) {
          return true;
        }
      }
      return false;
    });

    expect(hasTailwindArbitrary).toBe(true);
  });

  test('V1 和 V2 截圖', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/admin-v1.png', fullPage: true });

    await page.goto('/v2.html#/admin');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/admin-v2.png', fullPage: true });
  });
});
