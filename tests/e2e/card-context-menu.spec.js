// @ts-check
/** #1695：右鍵 / Shift+F10 / Delete 擴大到行程卡、側欄行程列、收藏卡；權限與 ⋯ 選單同一份。 */
import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');

const TRIP = 'okinawa-trip-2026-Ray';
test.use({ viewport: { width: 1280, height: 800 } });

/** @param {import('@playwright/test').Page} page @param {string} role */
async function asRole(page, role) {
  await page.route('**/api/my-trips', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(MOCK_TRIPS_LIST.map((t) => ({ ...t, role }))),
  }));
}
/** @param {import('@playwright/test').Page} page */
async function withFavorites(page) {
  await page.route(/\/api\/poi-favorites$/, (route) => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 501, poiId: 1, poiName: '首里城', poiType: 'attraction', poiAddress: '那霸', favoritedAt: '2026-01-01T00:00:00Z' },
      { id: 502, poiId: 2, poiName: '美麗海水族館', poiType: 'attraction', poiAddress: '本部', favoritedAt: '2026-01-01T00:00:00Z' },
    ]) })
    : route.fallback());
}
const menuLabels = (/** @type {import('@playwright/test').Locator} */ menu) => menu.locator('[role="menuitem"]').allInnerTexts();

test.beforeEach(async ({ page }) => { await setupApiMocks(page); });

test.describe('行程卡', () => {
  test('右鍵開 TripCardMenu，刪除在最後，位置貼游標', async ({ page }) => {
    await page.goto('/trips');
    const card = page.getByTestId(`trips-list-card-${TRIP}`);
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    await card.click({ button: 'right', position: { x: 60, y: 30 } });
    const menu = page.getByTestId(`trip-card-menu-${TRIP}`);
    await expect(menu).toBeVisible();
    const labels = await menuLabels(menu);
    expect(labels[labels.length - 1]).toContain('刪除行程');
    const m = await menu.boundingBox();
    expect(Math.abs(m.x - (box.x + 60))).toBeLessThan(4);
    expect(Math.abs(m.y - (box.y + 30))).toBeLessThan(4);
  });
  test('Shift+F10 等效', async ({ page }) => {
    await page.goto('/trips');
    await page.getByTestId(`trips-list-card-${TRIP}`).focus();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByTestId(`trip-card-menu-${TRIP}`)).toBeVisible();
  });
  test('Delete 開既有刪除確認（owner）', async ({ page }) => {
    await page.goto('/trips');
    await page.getByTestId(`trips-list-card-${TRIP}`).focus();
    await page.keyboard.press('Delete');
    await expect(page.getByTestId('confirm-modal')).toContainText('確定刪除行程');
  });
  test('旅伴：選單沒有刪除與歸檔，Delete 不動作', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/trips');
    const card = page.getByTestId(`trips-list-card-${TRIP}`);
    await expect(card).toBeVisible();
    await card.click({ button: 'right' });
    await expect(page.getByTestId(`trip-card-menu-${TRIP}`)).toBeVisible();
    await expect(page.getByTestId(`trip-card-menu-delete-${TRIP}`)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await card.focus();
    await page.keyboard.press('Delete');
    await expect(page.getByTestId('confirm-modal')).toHaveCount(0);
  });
});

test.describe('側欄行程列', () => {
  test('右鍵開同一份選單，Delete 開確認', async ({ page }) => {
    await page.goto('/trips');
    const row = page.getByTestId(`sidebar-trip-${TRIP}`);
    await expect(row).toBeVisible();
    await row.click({ button: 'right' });
    const menu = page.getByTestId(`trip-card-menu-${TRIP}`);
    await expect(menu).toBeVisible();
    const labels = await menuLabels(menu);
    expect(labels[labels.length - 1]).toContain('刪除行程');
    await page.keyboard.press('Escape');
    await row.focus();
    await page.keyboard.press('Shift+F10');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await row.focus();
    await page.keyboard.press('Delete');
    await expect(page.getByTestId('confirm-modal')).toContainText('確定刪除行程');
  });
  test('旅伴：側欄選單沒有刪除，Delete 不動作', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/trips');
    const row = page.getByTestId(`sidebar-trip-${TRIP}`);
    await expect(row).toBeVisible();
    await row.click({ button: 'right' });
    await expect(page.getByTestId(`trip-card-menu-${TRIP}`)).toBeVisible();
    await expect(page.getByTestId(`trip-card-menu-delete-${TRIP}`)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await row.focus();
    await page.keyboard.press('Delete');
    await expect(page.getByTestId('confirm-modal')).toHaveCount(0);
  });
});

test.describe('收藏卡', () => {
  test('右鍵開選單，移除收藏在最後；Delete 開確認只列該卡', async ({ page }) => {
    await withFavorites(page);
    await page.goto('/favorites');
    const card = page.getByTestId('favorites-card-501');
    await expect(card).toBeVisible();
    await card.click({ button: 'right', position: { x: 30, y: 20 } });
    const menu = page.locator('#fav-menu-501');
    await expect(menu).toBeVisible();
    const labels = await menuLabels(menu);
    expect(labels[labels.length - 1]).toContain('移除收藏');
    await page.keyboard.press('Escape');
    await page.getByTestId('favorites-check-501').focus();
    await page.keyboard.press('Shift+F10');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('favorites-add-to-trip-501').focus();
    await page.keyboard.press('Delete');
    const modal = page.getByTestId('confirm-modal');
    await expect(modal).toContainText('首里城');
    await expect(modal).not.toContainText('美麗海水族館');
  });

  test('焦點在卡內 checkbox 按 Delete 不觸發刪除', async ({ page }) => {
    await withFavorites(page);
    await page.goto('/favorites');
    await page.getByTestId('favorites-check-501').focus();
    await page.keyboard.press('Delete');
    await expect(page.getByTestId('confirm-modal')).toHaveCount(0);
  });

  test('已多選時：卡在選取內整批移除並寫明筆數；不在選取內只移除該張且不動選取', async ({ page }) => {
    await withFavorites(page);
    await page.goto('/favorites');
    await page.getByTestId('favorites-check-501').check();
    await page.getByTestId('favorites-check-502').check();
    await page.getByTestId('favorites-add-to-trip-501').focus();
    await page.keyboard.press('Delete');
    const modal = page.getByTestId('confirm-modal');
    await expect(modal).toContainText('移除 2 筆');
    await expect(modal).toContainText('美麗海水族館');
    await page.keyboard.press('Escape');
    await page.getByTestId('favorites-check-502').uncheck();
    await page.getByTestId('favorites-card-502').click({ button: 'right', position: { x: 30, y: 20 } });
    await page.getByTestId('favorites-menu-remove-502').click();
    await expect(modal).toContainText('移除 1 筆');
    await expect(modal).toContainText('美麗海水族館');
    await expect(modal).not.toContainText('首里城');
    await page.getByTestId('confirm-modal-cancel').click();
    await expect(page.getByTestId('favorites-check-501')).toBeChecked();
  });
});

test.describe('timeline entry 權限', () => {
  test('viewer：沒有刪除景點，Delete 不動作', async ({ page }) => {
    await asRole(page, 'viewer');
    await page.goto(`/trip/${TRIP}`);
    const row = page.getByTestId('timeline-rail-row-101');
    await expect(row).toBeVisible();
    await row.click({ button: 'right', position: { x: 40, y: 20 } });
    await expect(page.locator('#rail-menu-101')).toBeVisible();
    await expect(page.getByTestId('timeline-rail-delete-101')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByTestId('timeline-rail-toggle-101').focus();
    await page.keyboard.press('Delete');
    await expect(page.getByTestId('confirm-modal')).toHaveCount(0);
  });
  test('member：仍可刪除景點', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto(`/trip/${TRIP}`);
    await page.getByTestId('timeline-rail-toggle-101').focus();
    await page.keyboard.press('Delete');
    await expect(page.getByTestId('confirm-modal')).toBeVisible();
  });
});
