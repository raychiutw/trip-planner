// @ts-check
// #1700：Day tab 文字比照 App —— 地圖第一項「全部」、其餘「Day N」（行程詳情同為「Day N」）。
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

const TRIP = 'okinawa-trip-2026-Ray';

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

for (const [name, size] of [['桌機 1280', { width: 1280, height: 800 }], ['手機 390', { width: 390, height: 844 }]]) {
  test.describe(name, () => {
    test.use({ viewport: size });

    test('地圖 Day tab：全部／Day N', async ({ page }) => {
      await page.goto(`/trip/${TRIP}/map?day=all`);
      await expect(page.getByTestId('map-day-overview')).toHaveText('全部');
      await expect(page.getByTestId('map-day-2')).toHaveText('Day 2');
    });

    test('行程詳情 Day tab：Day N', async ({ page }) => {
      await page.goto(`/trips?selected=${TRIP}`);
      await expect(page.getByTestId('dn-day-2')).toHaveText(/^Day 2( · 今天)?$/);
    });
  });
}
