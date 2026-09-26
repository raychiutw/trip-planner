// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await setupApiMocks(page);
});

test('desktop restores an accessible trip and its day across reload', async ({ page }) => {
  const tripId = 'busan-trip-2026-Demo';
  await page.addInitScript((id) => {
    const exp = Date.now() + 86400000;
    localStorage.setItem('tp-trip-pref', JSON.stringify({ v: id, exp }));
    localStorage.setItem('tp-last-trip-view', JSON.stringify({ v: { tripId: id, dayNum: 2 }, exp }));
  }, tripId);
  await page.goto('/trips');
  await expect(page).toHaveURL(new RegExp(`selected=${tripId}.*#day2`));
  await expect(page.getByTestId('trip-main-portal')).toBeVisible();
  await expect(page.locator('.tp-embedded-trip .tp-titlebar')).toContainText('釜山三日遊');
  await page.reload();
  await expect(page.getByTestId('trip-main-portal')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`selected=${tripId}.*#day2`));
});

test('desktop filter does not remove an accessible trip from the detail picker', async ({ page }) => {
  const tripId = 'busan-trip-2026-Demo';
  await page.goto('/trips');
  await page.getByTestId('trips-list-search-toggle').click();
  await page.getByTestId('trips-list-search-input').fill('沖繩');
  await expect(page.getByTestId(`trips-list-card-${tripId}`)).toHaveCount(0);
  await page.getByRole('navigation', { name: '我的行程' }).getByRole('link', { name: '釜山三日遊' }).click();
  await expect(page.getByTestId('trip-main-portal')).toBeVisible();
  await page.getByTestId('trips-trip-title').click();
  await expect(page.getByTestId(`trips-trip-pick-${tripId}`)).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('trips-trip-pick-okinawa-trip-2026-Ray')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(new RegExp(`selected=${tripId}`));
});

test('mobile list selection follows browser back and forward', async ({ page }) => {
  const tripId = 'busan-trip-2026-Demo';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/trips');
  await expect(page.getByTestId('trips-list-page')).toBeVisible();
  await page.getByTestId(`trips-list-card-${tripId}`).click();
  await expect(page).toHaveURL(new RegExp(`selected=${tripId}`));
  await expect(page.getByTestId('trip-main-portal')).toHaveCount(0);
  await expect(page.locator('.tp-embedded-trip .tp-titlebar')).toContainText('釜山三日遊');
  await page.goBack();
  await expect(page.getByTestId(`trips-list-card-${tripId}`)).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`selected=${tripId}`));
  await expect(page.locator('.tp-embedded-trip .tp-titlebar')).toContainText('釜山三日遊');
});

test('summary refresh keeps selected detail and nonzero reading position', async ({ page }) => {
  const tripId = 'okinawa-trip-2026-Ray';
  let title = '2026 沖繩自駕五日遊';
  await page.route('**/api/my-trips', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(MOCK_TRIPS_LIST.map((trip) => trip.tripId === tripId ? { ...trip, title } : trip)),
  }));
  await page.goto(`/trips?selected=${tripId}`);
  await expect(page.getByTestId('trip-main-portal')).toBeVisible();
  const main = page.locator('.app-shell-main').first();
  await main.evaluate((el) => { el.scrollTop = 250; });
  await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBeGreaterThan(40);
  title = '更新後的沖繩行程'.repeat(8);
  await page.evaluate((id) => window.dispatchEvent(new CustomEvent('tp-trip-updated', { detail: { tripId: id } })), tripId);
  await expect(page.locator('.tp-embedded-trip .tp-titlebar')).toContainText(title);
  await expect(page.getByTestId('trip-main-portal')).toBeVisible();
  await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBeGreaterThan(40);
  await expect(page).toHaveURL(new RegExp(`selected=${tripId}`));
});
