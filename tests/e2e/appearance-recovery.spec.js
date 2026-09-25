import { test, expect } from '@playwright/test';
for (const sheet of [false, true]) test(`appearance follows the chosen mode across system changes and reload, sheet=${sheet}`, async ({ page }) => {
  await page.setViewportSize({ width: sheet ? 390 : 1280, height: 844 }); await page.emulateMedia({ colorScheme: 'light' });
  await page.route('**/api/**', route => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/oauth/userinfo' ? { id: 'reader', email: 'reader@example.com', displayName: 'Reader' } : [] }));
  await page.goto(sheet ? '/trips' : '/account/appearance');
  if (sheet) { await page.getByTestId('titlebar-account').click(); await page.getByTestId('account-row-appearance').click(); }
  const control = page.getByTestId('appearance-theme-toggle'); const dark = control.getByRole('button', { name: '深色', exact: true });
  const light = control.getByRole('button', { name: '淺色', exact: true }); const auto = control.getByRole('button', { name: '跟隨系統', exact: true });
  await expect(auto).toHaveAttribute('aria-pressed', 'true');
  for (const button of [dark, light]) {
    await button.focus(); await page.keyboard.press('Enter'); await expect(button).toBeFocused();
    const isDark = button === dark; await expect(page.locator('body')).toHaveClass(isDark ? /dark/ : /^(?!.*\bdark\b)/);
    await page.emulateMedia({ colorScheme: isDark ? 'dark' : 'light' }); await page.emulateMedia({ colorScheme: isDark ? 'light' : 'dark' });
    await expect(page.locator('body')).toHaveClass(isDark ? /dark/ : /^(?!.*\bdark\b)/);
    expect(await control.locator('button[aria-pressed="true"]').count()).toBe(1);
    const contrast = () => page.getByTestId('appearance-page').evaluate(root => {
      const luminance = color => { const parts = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => { const x = n / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return parts[0] * .2126 + parts[1] * .7152 + parts[2] * .0722; };
      return [...root.querySelectorAll('.tp-theme-toggle-btn, .tp-appearance-helper, h2')].map(el => {
        let parent = el; while (getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)') parent = parent.parentElement;
        const a = luminance(getComputedStyle(el).color); const b = luminance(getComputedStyle(parent).backgroundColor);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      });
    });
    await expect.poll(async () => Math.min(...await contrast())).toBeGreaterThanOrEqual(4.5);
    for (const target of [dark, light, auto]) expect((await target.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  await auto.click(); await expect(page.locator('body')).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'light' }); await expect(page.locator('body')).not.toHaveClass(/dark/);
  await dark.click(); await page.reload(); await expect(dark).toHaveAttribute('aria-pressed', 'true'); await expect(page.locator('body')).toHaveClass(/dark/);
  await page.goto('/trips'); await expect(page.locator('body')).toHaveClass(/dark/); await page.emulateMedia({ colorScheme: 'dark' }); await page.emulateMedia({ colorScheme: 'light' }); await expect(page.locator('body')).toHaveClass(/dark/);
});
test('native print presentation restores the current theme without changing its saved mode', async ({ page }) => {
  const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks'); await setupApiMocks(page);
  await page.route('**/api/permissions?*', route => route.fulfill({ json: [] }));
  await page.route('**/api/invitations?*', route => route.fulfill({ json: [] }));
  await page.emulateMedia({ colorScheme: 'dark' }); await page.goto('/account/appearance');
  await page.getByTestId('appearance-theme-auto').click();
  await page.goto(`/trip/${MOCK_TRIPS_LIST[0].tripId}`); await expect(page.locator('#tripContent')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/dark/);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); await expect(page.locator('body')).toHaveClass(/print-mode/); await expect(page.locator('body')).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'light' }); await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('body')).not.toHaveClass(/print-mode|dark/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tp-color-mode')).v)).toBe('auto');
  await page.emulateMedia({ colorScheme: 'dark' }); await expect(page.locator('body')).toHaveClass(/dark/);
});
