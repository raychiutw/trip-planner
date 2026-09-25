import { test, expect } from '@playwright/test';

for (const width of [320, 1280]) for (const scale of [1, 2]) {
  test(`landing remains readable and starts login at ${width}px, text ${scale * 100}%`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route('**/api/**', route => route.fulfill({ status: 401, json: { error: 'unauthorized' } }));
    await page.goto('/');
    const landing = page.getByTestId('landing-page');
    await expect(landing).toBeVisible();
    // Renderer-only text enlargement: snapshot sizes before changing inheritance.
    // SVG illustrations keep their own coordinate system and accessible descriptions.
    await landing.evaluate((root, factor) => {
      const sizes = [...root.querySelectorAll('*')].filter(el => el instanceof HTMLElement)
        .map(el => [el, parseFloat(getComputedStyle(el).fontSize)]);
      for (const [el, size] of sizes) el.style.fontSize = `${size * factor}px`;
    }, scale);
    await expect(landing.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(landing.getByRole('heading', { level: 2 })).toHaveCount(2);
    await expect(landing.getByRole('heading', { level: 3 })).toHaveCount(3);
    await expect(landing.getByRole('img')).toHaveCount(4);
    for (const illustration of await landing.getByRole('img').all()) await expect(illustration).toHaveAccessibleName(/示意/);
    const primary = landing.getByRole('link', { name: '登入後開始使用' }).first();
    await expect(primary).toHaveAttribute('href', '/login');
    await expect(landing.getByText('登入後就能開始排，也可以把既有行程用 JSON 匯入。')).toBeVisible();
    await expect(landing.getByRole('link', { name: /匯入/ })).toHaveCount(0);
    for (const mode of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: mode });
      await expect.poll(() => page.locator('body').evaluate(el => el.classList.contains('dark'))).toBe(mode === 'dark');
      expect(await landing.evaluate(root => {
        const errors = [];
        const viewport = document.documentElement.clientWidth;
        for (const el of root.querySelectorAll('h1,h2,h3,p,a')) {
          const range = document.createRange(); range.selectNodeContents(el);
          const box = el.getBoundingClientRect();
          if ([...range.getClientRects()].some(rect => rect.left < Math.max(0, box.left) - 1 || rect.right > Math.min(viewport, box.right) + 1 || rect.bottom > box.bottom + 1)) errors.push(el.textContent);
        }
        if (document.documentElement.scrollWidth > viewport) errors.push('horizontal overflow');
        return errors;
      })).toEqual([]);
      for (const link of await landing.getByRole('link').all()) {
        expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
    }
    await primary.focus(); await expect(primary).toBeFocused(); await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
    await page.getByTestId('login-home-link').click(); await expect(landing).toBeVisible();
    await landing.getByRole('link', { name: '隱私權政策' }).press('Enter'); await expect(page).toHaveURL(/\/privacy$/);
  });
}
