// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

const TRIP_ID = 'okinawa-trip-2026-Ray';

async function setup(page) {
  await setupApiMocks(page);
  await page.route('**/api/route**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ routes: [{ geometry: { coordinates: [] }, duration: 0, distance: 0 }] }),
    });
  });
  await page.addInitScript((tripId) => {
    const exp = Date.now() + 180 * 86400000;
    localStorage.setItem('tp-trip-pref', JSON.stringify({ v: tripId, exp }));
  }, TRIP_ID);
}

test.beforeEach(async ({ page }) => {
  await setup(page);
});

test.describe('Layout quality gates', () => {
  test('desktop trip detail exposes current TitleBar menu actions', async ({ page }) => {
    await page.goto(`/trips?selected=${TRIP_ID}`);
    await expect(page.getByRole('heading', { name: /2026 沖繩自駕五日遊/ })).toBeVisible();

    await page.getByTestId('trips-embedded-menu-trigger').click();
    const menu = page.getByTestId(`trip-embedded-menu-${TRIP_ID}`);
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /共編設定/ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /^PDF$/ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /Markdown/ })).toBeVisible();
  });

  test('desktop trip detail exposes timeline reorder affordances', async ({ page }) => {
    await page.goto(`/trips?selected=${TRIP_ID}`);
    await expect(page).toHaveURL(new RegExp(`/trips\\?selected=${TRIP_ID}`));
    await expect(page.getByRole('heading', { name: /2026 沖繩自駕五日遊/ })).toBeVisible();

    const firstGrip = page.getByRole('button', { name: /拖拉排序/ }).first();
    const firstRow = page.getByRole('button', { name: /展開景點/ }).first();
    await expect(firstGrip).toBeVisible();
    await expect(firstRow).toBeVisible();
  });

  test('mobile Explore can save a POI and send selected saved POIs to a trip', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/explore');
    await expect(page.getByTestId('explore-page')).toBeVisible();

    await page.getByTestId('explore-search-input').fill('水族館');
    await page.getByTestId('explore-search-submit').click();
    await expect(page.getByTestId('explore-results')).toContainText('沖繩美麗海水族館');
    await page.getByTestId('explore-save-btn-90001').click();
    await expect(page.getByTestId('explore-save-btn-90001')).toContainText('已儲存');

    await page.getByTestId('explore-tab-saved').click();
    await expect(page.getByTestId('saved-card-8001')).toBeVisible();
    await page.getByTestId('saved-check-8001').check();
    await page.getByTestId('explore-add-to-trip').click();
    await page.getByTestId(`explore-trip-pick-${TRIP_ID}`).click();

    await expect(page).toHaveURL(new RegExp(`/trips\\?selected=${TRIP_ID}`));
  });
});
