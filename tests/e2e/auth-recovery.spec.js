import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');
const trip = '/trip/okinawa-trip-2026-Ray';
for (const path of ['/account', '/developer/apps/new', '/trips/new', `${trip}/edit`, `${trip}/add-entry`, `${trip}/add-stop`, `${trip}/add-custom-stop`, `${trip}/stop/101/copy`]) test(`failed auth probe has a retry without abandoning ${path}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupApiMocks(page);
  let available = false;
  await page.route('**/api/oauth/userinfo', route => {
    if (new URL(route.request().url()).pathname === '/api/oauth/userinfo') return route.fulfill({ status: available ? 200 : 503, json: available ? { id: 'reader', email: 'reader@example.com', displayName: 'Reader' } : {} });
    return route.fulfill({ json: [] });
  });
  const initial = `${path}?keep=context${path.endsWith('/add-custom-stop') ? '&day=1' : ''}#position`;
  await page.goto(initial);
  const retry = page.getByRole('button', { name: '重試登入狀態', exact: true });
  await expect(retry).toBeVisible();
  await expect(page.getByTestId('auth-status').getByRole('alert')).toContainText('無法確認登入狀態');
  const rejected = page.waitForResponse(response => response.url().endsWith('/api/oauth/userinfo') && response.status() === 503);
  await retry.press('Enter'); await rejected; await expect(retry).toBeEnabled();
  await expect(retry).toBeFocused();
  await expect(page).toHaveURL(initial);
  available = true; await retry.press('Enter');
  await expect(retry).not.toBeVisible();
  const target = { '/account': 'account-edit-name-btn', '/developer/apps/new': 'dev-app-new-submit', '/trips/new': 'new-trip-page', [`${trip}/edit`]: 'edit-trip-page', [`${trip}/add-entry`]: 'add-entry-page', [`${trip}/add-stop`]: 'add-stop-page', [`${trip}/add-custom-stop`]: 'add-custom-stop-confirm', [`${trip}/stop/101/copy`]: 'entry-action-page' }[path];
  await expect(page.getByTestId(target)).toBeVisible();
  await expect(page).toHaveURL(url => url.pathname === path && url.searchParams.get('keep') === 'context' && url.hash === '#position');
});
