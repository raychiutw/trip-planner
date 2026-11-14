// @ts-check
/** #1694：timeline entry 列右鍵 / Shift+F10 開既有 ⋯ 選單，Delete 開同一個刪除確認。 */
import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST, MOCK_USER } = require('./api-mocks');

const TRIP = '/trip/okinawa-trip-2026-Ray';
const ROW = 'timeline-rail-row-101';

test.use({ viewport: { width: 1280, height: 800 } });
test.beforeEach(async ({ page }) => { await setupApiMocks(page); await page.goto(TRIP); });

test('右鍵開 ⋯ 選單，位置跟著游標', async ({ page }) => {
  const row = page.getByTestId(ROW);
  await expect(row).toBeVisible();
  const box = await row.boundingBox();
  const x = box.x + 40, y = box.y + 20;
  await row.click({ button: 'right', position: { x: 40, y: 20 } });
  const menu = page.locator('#rail-menu-101');
  await expect(menu).toBeVisible();
  await expect(page.getByTestId('timeline-rail-delete-101')).toBeVisible();
  const m = await menu.boundingBox();
  expect(Math.abs(m.x - x)).toBeLessThan(4);
  expect(Math.abs(m.y - y)).toBeLessThan(4);
});

test('Shift+F10 等效', async ({ page }) => {
  await page.getByTestId('timeline-rail-toggle-101').focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.locator('#rail-menu-101')).toBeVisible();
});

test('Delete 開同一個確認對話框；輸入框內不觸發', async ({ page }) => {
  await page.getByTestId('timeline-rail-toggle-101').focus();
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('confirm-modal')).toBeVisible();
  await page.getByTestId('confirm-modal').getByRole('button', { name: /取消/ }).click();
  await expect(page.getByTestId('confirm-modal')).toBeHidden();
  // 輸入框內 Delete 只刪字：經 ⋯ 選單進入備註編輯，textarea 必須真的出現（不用 if 包住，否則恆綠）
  await page.getByTestId(ROW).click({ button: 'right', position: { x: 40, y: 20 } });
  await page.getByTestId('timeline-rail-menu-note-101').click();
  const field = page.getByTestId('timeline-rail-note-input-101');
  await expect(field).toBeVisible();
  await field.focus();
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('confirm-modal')).toBeHidden();
});

test('/api/my-trips 沒帶 role 但 ownerUserId 是自己：擁有者仍能刪景點', async ({ page }) => {
  await page.route('**/api/my-trips', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(MOCK_TRIPS_LIST.map(({ role: _role, ...t }) => ({ ...t, ownerUserId: MOCK_USER.id }))),
  }));
  await page.goto(TRIP);
  await page.getByTestId(ROW).click({ button: 'right', position: { x: 40, y: 20 } });
  await expect(page.getByTestId('timeline-rail-delete-101')).toBeVisible();
});

test('viewer：選單沒有刪除景點', async ({ page }) => {
  await page.route('**/api/my-trips', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(MOCK_TRIPS_LIST.map((t) => ({ ...t, role: 'viewer', ownerUserId: 'someone-else' }))),
  }));
  await page.goto(TRIP);
  await page.getByTestId(ROW).click({ button: 'right', position: { x: 40, y: 20 } });
  await expect(page.locator('#rail-menu-101')).toBeVisible();
  await expect(page.getByTestId('timeline-rail-delete-101')).toHaveCount(0);
});

test('列外右鍵保留原生選單', async ({ page }) => {
  const prevented = await page.evaluate(() => {
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 });
    document.body.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(prevented).toBe(false);
});
