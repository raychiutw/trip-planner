// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test.describe('Settings pages', () => {
  test('sessions page loads inside the shared shell with PageHeader hero', async ({ page }) => {
    await page.goto('/settings/sessions');
    await expect(page.getByRole('heading', { name: '帳號' })).toBeVisible();
    await expect(page.getByTestId('sessions-user-email')).toContainText('lean.lean@gmail.com');
    await expect(page.getByTestId('sessions-row-current')).toContainText('Chrome on macOS');
  });

  test('connected apps page is reachable from direct route', async ({ page }) => {
    await page.goto('/settings/connected-apps');
    await expect(page.getByRole('heading', { name: '已連結的應用' })).toBeVisible();
    await expect(page.getByTestId('connected-apps-row-weather-importer')).toContainText('Weather Importer');
  });
});
