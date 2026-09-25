import { test, expect } from '@playwright/test';
for (const width of [390, 1280]) test(`developer registry recovers and remains readable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const app = { client_id: 'tp_' + 'longclient'.repeat(12), client_type: 'confidential', app_name: 'Planner'.repeat(12), redirect_uris: ['https://example.com/' + 'callback'.repeat(60)], allowed_scopes: ['openid'], status: 'active', created_at: '2026-09-24T00:00:00Z', client_secret: 'never-render-secret', client_secret_hash: 'never-render-hash' };
  let status = 500; let apps = [app];
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/oauth/userinfo') return route.fulfill({ json: { id: 'reader', email: 'reader@example.com', displayName: 'Reader' } });
    if (path === '/api/dev/apps') return route.fulfill({ json: { apps }, status });
    return route.fulfill({ json: [] });
  });
  await page.goto('/developer/apps'); await expect(page.getByTestId('dev-apps-error')).toContainText('無法載入');
  await expect(page.getByTestId('dev-apps-empty')).not.toBeVisible();
  status = 403; await page.getByRole('button', { name: '重試載入應用' }).press('Enter');
  await expect(page.getByTestId('dev-apps-error')).toContainText('沒有權限');
  await expect(page.getByRole('button', { name: '建立新應用' })).not.toBeVisible();
  status = 200; await page.getByRole('button', { name: '重試載入應用' }).press('Enter');
  const row = page.locator('[data-testid^="dev-apps-row-"]'); await expect(row).toContainText(app.redirect_uris[0]);
  await expect(page.getByLabel('開發者應用清單', { exact: true })).toBeFocused();
  if (width < 1024) await expect(page.getByTestId('global-bottom-nav')).toBeVisible();
  else await expect(page.getByTestId('desktop-sidebar')).toBeVisible();
  await expect(row).toContainText(app.app_name); await expect(row).toContainText(app.client_id);
  expect(await row.locator('.tp-app-name, .tp-app-cid').evaluateAll(els => els.every(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    return [...range.getClientRects()].every(rect => rect.right <= el.getBoundingClientRect().right + 1 && rect.right <= innerWidth);
  }))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.content()).not.toContain('never-render-secret'); expect(await page.content()).not.toContain('never-render-hash');
  apps = []; await page.evaluate(() => window.dispatchEvent(new Event('tp-developer-app-created')));
  const create = page.getByRole('button', { name: '建立第一個應用' }); await expect(create).toBeVisible();
  await create.focus(); await page.keyboard.press('Enter'); await expect(page).toHaveURL(/\/developer\/apps\/new$/);
});
