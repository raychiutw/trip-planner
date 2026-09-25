import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');
for (const width of [390, 1280]) test(`account chrome retries its own failed identity at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await setupApiMocks(page);
  let available = false;
  await page.route('**/api/oauth/userinfo', route => route.fulfill({
    status: available ? 200 : 503,
    json: available ? { id: 'reader', email: 'reader@example.com', displayName: 'Reader' } : {},
  }));
  await page.goto('/trip/okinawa-trip-2026-Ray/map?day=all#position');
  const chrome = width < 1024 ? page.getByTestId('titlebar') : page.getByTestId('desktop-sidebar');
  const retry = chrome.getByRole('button', { name: '重試登入狀態', exact: true });
  await expect(retry).toBeVisible();
  await expect(retry).toHaveAttribute('aria-disabled', 'false');
  const failed = page.waitForResponse(r => r.url().endsWith('/api/oauth/userinfo') && r.status() === 503);
  await retry.press('Enter'); await failed;
  await expect(retry).toHaveAttribute('aria-disabled', 'false');
  await expect(retry).toBeFocused();
  available = true; await retry.press('Enter');
  await expect(chrome.getByRole('link', { name: width < 1024 ? '帳號' : '帳號設定：Reader', exact: true })).toBeVisible();
  await expect(page).toHaveURL('/trip/okinawa-trip-2026-Ray/map?day=all#position');
});
