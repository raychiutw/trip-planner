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

  // v2.22.0 (poi-favorites-rename DUC1)：batch toolbar 改 delete-only，
  // 「multi-select 後 batch send to trip」概念已廢；per-card「加入行程 →」link
  // 是唯一 add-to-trip 入口（testid `favorites-add-to-trip-{id}`）。
  test('mobile Explore save POI → /favorites per-card add-to-trip link', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/explore');
    await expect(page.getByTestId('explore-page')).toBeVisible();

    await page.getByTestId('explore-search-input').fill('水族館');
    await page.getByTestId('explore-search-submit').click();
    await expect(page.getByTestId('explore-results')).toContainText('沖繩美麗海水族館');
    await page.getByTestId('explore-save-btn-ChIJPZ5hUjH65DQR_p_dD3CmCOo').click();
    await expect(page.getByTestId('explore-save-btn-ChIJPZ5hUjH65DQR_p_dD3CmCOo')).toHaveClass(/is-saved/);

    await page.goto('/favorites');
    await expect(page.getByTestId('favorites-card-8001')).toBeVisible();
    // per-card add-to-trip link 是唯一 entry（DUC1 batch delete-only）
    await expect(page.getByTestId('favorites-add-to-trip-8001'))
      .toHaveAttribute('href', '/favorites/8001/add-to-trip');
  });
});
