// @ts-check
/**
 * #1698 觸控大螢幕（iPad 橫向）走桌機版，hover-only 控制必須常駐。
 * 1280 寬 + hasTouch：版面仍是桌機三欄，指標為無 hover。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

const TRIP_ID = 'okinawa-trip-2026-Ray';

test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });

const opacityOf = (loc) => loc.evaluate((el) => parseFloat(getComputedStyle(el).opacity));

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  await page.route('**/api/route**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ routes: [] }) }));
  await page.addInitScript((tripId) => {
    localStorage.setItem('tp-trip-pref', JSON.stringify({ v: tripId, exp: Date.now() + 180 * 86400000 }));
  }, TRIP_ID);
});

test('觸控 1280 寬：仍是桌機版且無 hover', async ({ page }) => {
  await page.goto(`/trip/${TRIP_ID}`);
  await expect(page.getByRole('button', { name: /更多動作/ }).first()).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(min-width: 1024px)').matches)).toBe(true);
});

test('timeline 列 ⋯ 在觸控下完全不透明且可點', async ({ page }) => {
  await page.goto(`/trip/${TRIP_ID}`);
  const more = page.getByRole('button', { name: /更多動作/ }).first();
  await expect(more).toBeVisible({ timeout: 10000 });
  expect(await opacityOf(more)).toBe(1);
  await more.tap();
  await expect(page.getByRole('menuitem', { name: '重新排序' })).toBeVisible();
});

test('行程筆記 grip 在觸控下常駐', async ({ page }) => {
  await page.route(new RegExp(`/api/trips/${TRIP_ID}/notes/ai-state$`), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ jobs: [] }) }));
  await page.route(new RegExp(`/api/trips/${TRIP_ID}/notes$`), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      flights: [{ id: 1, sortOrder: 0, airline: '中華航空', flightNo: 'CI 120', cabinClass: '', departAirport: 'TPE', arriveAirport: 'OKA', departAt: '2026-07-26T09:35', arriveAt: '2026-07-26T12:00', note: '', version: 0 }],
      lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    }) }));
  await page.goto(`/trip/${TRIP_ID}/notes`);
  const head = page.getByTestId('trip-notes-section-head-flights');
  await expect(head).toBeVisible({ timeout: 10000 });
  if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click();
  const grip = page.locator('.tp-notes-flight-grip').first();
  await expect(grip).toBeAttached();
  expect(await opacityOf(grip)).toBe(1);
});
