import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');
const trip = '/trip/okinawa-trip-2026-Ray';
const cases = [
  ['/developer/apps', 'developer-apps-page'],
  ['/account/connected-apps', 'connected-apps-page'],
  ['/account/sessions', 'sessions-page'],
  ['/account/appearance', 'appearance-page'],
  ['/account/notifications', 'notifications-page'],
  ['/explore', 'explore-page'],
  [`${trip}/notes`, 'trip-notes-page'],
  [`${trip}/print`, 'trip-print-close'],
  [`${trip}/health`, 'ai-health-page'],
];
for (const [path, target] of cases) test(`reader identity recovers in place on ${path}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupApiMocks(page);
  await page.route('**/api/dev/apps', route => route.fulfill({ json: { apps: [] } }));
  let available = false;
  await page.route('**/api/oauth/userinfo', route => route.fulfill({
    status: available ? 200 : 503,
    json: available ? { id: 'reader', email: 'reader@example.com', displayName: 'Reader' } : {},
  }));
  const url = `${path}?keep=context#position`;
  await page.goto(url);
  const status = page.locator('[data-testid="auth-status"]:visible');
  await expect(status.getByRole('alert')).toBeVisible();
  if (path === '/account/appearance') {
    await page.getByTestId('appearance-theme-dark').click();
    await expect(page.getByTestId('appearance-theme-dark')).toHaveAttribute('aria-pressed', 'true');
  }
  if (path === '/account/notifications') await expect(page.getByRole('list', { name: '規劃中的通知類型' })).toBeVisible();
  const retry = status.getByRole('button', { name: '重試登入狀態' });
  const failed = page.waitForResponse(r => r.url().endsWith('/api/oauth/userinfo') && r.status() === 503);
  await retry.press('Enter'); await failed;
  await expect(retry).toHaveAttribute('aria-disabled', 'false');
  await expect(retry).toBeFocused();
  available = true; await retry.press('Enter');
  await expect(status).not.toBeVisible();
  await expect(page.getByTestId(target)).toBeVisible();
  if (path === '/account/appearance') await expect(page.getByTestId('appearance-theme-dark')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(url);
});
