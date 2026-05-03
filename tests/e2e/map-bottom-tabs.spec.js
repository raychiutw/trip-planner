// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  await page.route('**/api/route**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ polyline: [], duration: null, distance: 0, approx: true }),
    });
  });
});

test.describe('MapPage bottom day tabs', () => {
  test('switching a bottom day tab updates URL and resets cards to day-local index', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray/map?day=all');

    // PR #459 #6: nav 改 role=navigation (drop tablist)，button 用 plain
     // type=button + aria-current 取代 role=tab + aria-selected。
    const tabs = page.getByRole('navigation', { name: '行程日期' });
    await expect(tabs).toBeVisible();
    await expect(tabs.getByRole('button', { name: /總覽/ })).toHaveAttribute('aria-current', 'true');

    await tabs.getByRole('button', { name: /DAY 02/ }).click();

    await expect(page).toHaveURL(/\/trip\/okinawa-trip-2026-Ray\/map\?day=2$/);
    await expect(tabs.getByRole('button', { name: /DAY 02/ })).toHaveAttribute('aria-current', 'true');

    const firstCard = page.locator('.tp-map-entry-card').first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.locator('.tp-map-entry-card-num')).toHaveText('1');

    await firstCard.click();
    await expect(firstCard).toHaveAttribute('aria-pressed', 'true');
  });
});
