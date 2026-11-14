// @ts-check
/**
 * 收藏 ⌘／Ctrl-click 加選、⇧-click 範圍選（trip-planner#1714）。
 * 與既有勾選模式共用同一份選取狀態：結果看 checkbox 與「已選 N 個」。
 * 執行：npx playwright test tests/e2e/favorites-multiselect-1714.spec.js --project=chromium
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

const ROWS = [1, 2, 3, 4, 5].map((n) => ({
  id: 9000 + n, poiId: n, poiName: `景點${n}`, poiAddress: `地址${n}`, poiType: 'attraction',
  favoritedAt: '2026-10-01T00:00:00Z', note: null, poiLat: 26.2, poiLng: 127.7,
}));

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
  await page.setViewportSize({ width: 1280, height: 800 });
  await setupApiMocks(page);
  await page.route(/\/api\/poi-favorites$/, (r) =>
    r.request().method() === 'GET'
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROWS) })
      : r.fallback());
  await page.goto('/favorites');
  await expect(page.getByTestId('favorites-card-9001')).toBeVisible();
});

const card = (page, n) => page.getByTestId(`favorites-card-${9000 + n}`);
const check = (page, n) => page.getByTestId(`favorites-check-${9000 + n}`);
const title = (page, n) => card(page, n).locator('.poi-name');

test('一般點卡片不選取', async ({ page }) => {
  await title(page, 1).click();
  await expect(check(page, 1)).not.toBeChecked();
});

test('⌘-click 加選與取消（Ctrl-click 在 Mac 是右鍵不發 click，故用 Meta）', async ({ page }) => {
  await title(page, 1).click({ modifiers: ['Meta'] });
  await title(page, 3).click({ modifiers: ['Meta'] });
  await expect(check(page, 1)).toBeChecked();
  await expect(check(page, 2)).not.toBeChecked();
  await expect(check(page, 3)).toBeChecked();
  await expect(page.getByText('已選 2 個')).toBeVisible();
  await title(page, 1).click({ modifiers: ['Meta'] });
  await expect(check(page, 1)).not.toBeChecked();
  await expect(page.getByText('已選 1 個')).toBeVisible();
});

test('Meta-click 同樣加選', async ({ page }) => {
  await title(page, 2).click({ modifiers: ['Meta'] });
  await expect(check(page, 2)).toBeChecked();
});

test('Shift-click 從錨點選到該卡的範圍', async ({ page }) => {
  await check(page, 2).check(); // 既有勾選模式設下錨點
  await title(page, 4).click({ modifiers: ['Shift'] });
  for (const n of [2, 3, 4]) await expect(check(page, n)).toBeChecked();
  for (const n of [1, 5]) await expect(check(page, n)).not.toBeChecked();
  await expect(page.getByText('已選 3 個')).toBeVisible();
});

test('Shift-click 沒有錨點時只選該卡', async ({ page }) => {
  await title(page, 3).click({ modifiers: ['Shift'] });
  await expect(page.getByText('已選 1 個')).toBeVisible();
  await expect(page).toHaveURL(/\/favorites$/);
});

test('⌘-click 勾選框本身只切一次（勾選框 onChange 與卡片 click 不互相抵銷）', async ({ page }) => {
  await check(page, 2).click({ modifiers: ['Meta'] });
  await expect(check(page, 2)).toBeChecked();
  await expect(page.getByText('已選 1 個')).toBeVisible();
  await check(page, 2).click({ modifiers: ['Meta'] });
  await expect(check(page, 2)).not.toBeChecked();
});

test('⇧-click 勾選框同樣只切一次', async ({ page }) => {
  await check(page, 3).click({ modifiers: ['Shift'] });
  await expect(check(page, 3)).toBeChecked();
  await expect(page.getByText('已選 1 個')).toBeVisible();
});
