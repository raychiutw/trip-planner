// @ts-check
import { test, expect } from '@playwright/test';
// #1721：只做轉址的路由若掛在 TripLayout 底下，轉址前會先抓一次行程，轉到 /trips 後 TripPage 又抓一次。
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');

const tripId = MOCK_TRIPS_LIST[0].tripId;

for (const [w, h, path] of [[1280, 800, `/trips?selected=${tripId}`], [375, 844, `/trips?selected=${tripId}#day1`], [1280, 800, `/trip/${tripId}`], [375, 844, `/trip/${tripId}`], [1280, 800, `/trip/${tripId}/stop/101`]]) {
  test(`打開行程只抓一次行程資料與每日資料 ${w} ${path}`, async ({ page }) => {
    await setupApiMocks(page);
    const log = [];
    const t0 = Date.now();
    page.on('request', (req) => {
      const { pathname, search } = new URL(req.url());
      if (pathname.startsWith('/api/')) log.push(`${Date.now() - t0}ms ${pathname}${search}`);
    });
    await page.setViewportSize({ width: w, height: h });
    await page.goto(path);
    await expect(page.locator('[data-day="1"]').first()).toBeVisible();
    await page.waitForTimeout(1500);
    const meta = log.filter((l) => l.endsWith(`/api/trips/${tripId}`)).length;
    const days = log.filter((l) => l.includes(`/api/trips/${tripId}/days?all=1`)).length;
    expect({ meta, days }, log.join('\n')).toEqual({ meta: 1, days: 1 });
  });
}
