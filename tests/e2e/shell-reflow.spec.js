import { test, expect } from '@playwright/test';

for (const width of [320, 375, 768, 1024, 1440]) test(`root navigation reflows with doubled text at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.route('**/api/**', route => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/oauth/userinfo' ? { id: 'reader', email: 'reader@example.com', displayName: 'Reader' } : [] }));
  await page.goto('/trips');
  const nav = width < 1024 ? page.getByTestId('global-bottom-nav') : page.locator('.tp-sidebar-nav');
  await expect(nav).toBeVisible();
  await page.evaluate(() => {
    const sizes = [...document.querySelectorAll('body *')].filter(el => el instanceof HTMLElement).map(el => [el, parseFloat(getComputedStyle(el).fontSize)]);
    for (const [el, size] of sizes) el.style.fontSize = `${size * 2}px`;
  });
  for (const mode of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
    const links = nav.getByRole('link'); await expect(links).toHaveCount(4);
    await expect(nav.locator('[aria-current="page"]')).toHaveText('行程');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const link of await links.all()) {
      await link.focus(); await expect(link).toBeFocused();
      const box = await link.boundingBox(); expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await link.evaluate(el => {
        const text = el.querySelector('span:last-child'); const range = document.createRange(); range.selectNodeContents(text);
        const box = text.getBoundingClientRect();
        return [...range.getClientRects()].every(rect => rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.bottom <= box.bottom + 1 && rect.top >= box.top - 1);
      })).toBe(true);
    }
  }
});

test('browser pinch zoom does not activate keyboard-only navigation hiding', async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.route('**/api/**', route => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/oauth/userinfo' ? { id: 'reader', email: 'reader@example.com' } : [] }));
  await page.goto('/trips');
  const nav = page.getByTestId('global-bottom-nav'); await expect(nav).toBeVisible();
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 4 });
    // Chromium may clamp desktop pinch scale to 3; this checks real magnification,
    // while the 320px case above covers the reflow width of 1280px at 400%.
    await expect.poll(() => page.evaluate(() => visualViewport.scale)).toBeGreaterThan(1);
    await expect(page.locator('html')).not.toHaveAttribute('data-kb-open', '1');
    await expect(nav).toBeVisible();
    expect(await page.locator('html').evaluate(el => el.style.getPropertyValue('--kb-inset'))).toBe('0px');
  } finally { await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 }); await cdp.detach(); }
});
