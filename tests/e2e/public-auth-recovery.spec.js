import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');
for (const kind of ['share', 'map', 'timeline']) test(`${kind} identity-dependent actions recover without abandoning the reader`, async ({ page }) => {
  await page.setViewportSize({ width: kind === 'timeline' ? 1280 : 390, height: 900 });
  await setupApiMocks(page);
  await page.route('**/api/share/**', route => route.fulfill({ json: { meta: { name: '公開分享', title: '公開分享' }, days: [], notes: {} } }));
  let available = false;
  await page.route('**/api/oauth/userinfo', route => route.fulfill({ status: available ? 200 : 503, json: available ? { id: 'reader', email: 'reader@example.com' } : {} }));
  const path = kind === 'share' ? '/s/reader-token' : `/trip/okinawa-trip-2026-Ray/${kind === 'map' ? 'map' : 'notes'}`;
  await page.goto(`${path}?keep=context#position`);
  const reader = kind === 'timeline' ? page.getByTestId('trip-main-portal') : kind === 'map' ? page.getByTestId('app-shell-main') : page.locator('.tp-share-page');
  const status = reader.getByTestId('auth-status');
  await expect(status.getByRole('alert')).toBeVisible();
  if (kind === 'share') {
    await expect(page.getByRole('heading', { level: 1, name: '公開分享' })).toBeVisible();
    await expect(page.getByTestId('share-print')).toBeEnabled();
    await expect(page.getByTestId('share-copy')).toBeDisabled();
  }
  const retry = status.getByRole('button', { name: '重試登入狀態' });
  const failed = page.waitForResponse(r => r.url().endsWith('/api/oauth/userinfo') && r.status() === 503);
  await retry.press('Enter'); await failed;
  await expect(retry).toHaveAttribute('aria-disabled', 'false'); await expect(retry).toBeFocused();
  available = true; await retry.press('Enter');
  await expect(status).not.toBeVisible();
  if (kind === 'share') await expect(page.getByTestId('share-copy')).toBeEnabled();
  if (kind === 'map') {
    await page.getByTestId('map-trip-title').click();
    await expect(page.getByTestId('map-trip-pick-busan-trip-2026-Demo')).toBeVisible();
  }
  if (kind === 'timeline') await expect(reader.locator('.trip-content')).toBeVisible();
  await expect(page).toHaveURL(`${path}?keep=context#position`);
});
