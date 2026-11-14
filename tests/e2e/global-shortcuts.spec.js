// @ts-check
/**
 * 桌機 HIG 05（#1697）：全域快捷鍵 ⌥⌘F 聚焦搜尋、⌥⇧N 新增。
 * 只驗使用者看得到的行為：焦點、網址、tooltip、aria-keyshortcuts。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑'); });

const TRIP = 'okinawa-trip-2026-Ray';
const SEARCH = 'Alt+Meta+f';
const NEW = 'Alt+Shift+n';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await setupApiMocks(page);
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
  // 預設收藏為空 → 搜尋欄不渲染；放一筆讓它出現
  await page.route(/\/api\/poi-favorites$/, (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 1, poiId: 1, favoritedAt: '2026-01-01T00:00:00Z', note: null, poiName: '美麗海水族館', poiAddress: '沖繩', poiLat: 26.69, poiLng: 127.87, poiType: 'attraction' }]),
  }));
});

test('行程清單：⌥⌘F 展開並聚焦搜尋、⌥⇧N 開新增行程', async ({ page }) => {
  await page.goto('/trips');
  await expect(page.getByTestId('trips-list-search-toggle')).toBeVisible();
  await page.keyboard.press(SEARCH);
  await expect(page.getByTestId('trips-list-search-input')).toBeFocused();
  await page.keyboard.press(NEW);
  await expect(page).toHaveURL(/\/trips\/new/);
});

test('行程清單按鈕帶 aria-keyshortcuts，tooltip 寫出快捷鍵', async ({ page }) => {
  await page.goto('/trips');
  const add = page.getByTestId('trips-list-new-trip-titlebar');
  await expect(add).toHaveAttribute('aria-keyshortcuts', 'Alt+Shift+N');
  await expect(add).toHaveAttribute('title', /新增行程.*⌥⇧N/);
  const search = page.getByTestId('trips-list-search-toggle');
  await expect(search).toHaveAttribute('aria-keyshortcuts', 'Alt+Meta+F');
  await expect(search).toHaveAttribute('title', /搜尋.*⌥⌘F/);
});

test('行程詳情：⌥⇧N 新增 entry', async ({ page }) => {
  await page.goto(`/trips?selected=${TRIP}`);
  const add = page.getByTestId('trip-add-stop-trigger');
  await expect(add).toBeVisible();
  await expect(add).toHaveAttribute('aria-keyshortcuts', 'Alt+Shift+N');
  await page.keyboard.press(NEW);
  await expect(page).toHaveURL(new RegExp(`/trip/${TRIP}/add-entry`));
});

test('收藏、探索：⌥⌘F 聚焦搜尋欄', async ({ page }) => {
  await page.goto('/favorites');
  await expect(page.getByTestId('favorites-search-input')).toBeVisible();
  await page.keyboard.press(SEARCH);
  await expect(page.getByTestId('favorites-search-input')).toBeFocused();
  await page.goto('/explore');
  await expect(page.getByTestId('explore-search-input')).toBeVisible();
  await page.keyboard.press(SEARCH);
  await expect(page.getByTestId('explore-search-input')).toBeFocused();
});

test('沒有對應動作的頁面不做事', async ({ page }) => {
  await page.goto('/chat');
  const url = page.url();
  await page.keyboard.press(NEW);
  await page.keyboard.press(SEARCH);
  await page.waitForTimeout(300);
  expect(page.url()).toBe(url);
});

test('焦點在輸入框時一般按鍵照常輸入、不被攔截', async ({ page }) => {
  await page.goto('/favorites');
  const input = page.getByTestId('favorites-search-input');
  await input.click();
  await page.keyboard.type('nf');
  await expect(input).toHaveValue('nf');
  await expect(page).toHaveURL(/\/favorites$/);
});
