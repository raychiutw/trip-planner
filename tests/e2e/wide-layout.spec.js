/**
 * #1713：720–1023px 寬版（比照 App 的 regular 導覽，ADR-0009）。
 * 頂部全寬 bar（品牌＋4 個 root tab）＋左欄只放「我的行程」（240px）＋帳號左下；
 * 無右欄、無底部浮動膠囊、無 header 帳號圓圈。≥1024 與 ≤719 不變。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');

const tripId = MOCK_TRIPS_LIST[0].tripId;

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
});

const box = async (loc) => {
  const b = await loc.boundingBox();
  expect(b).toBeTruthy();
  return b;
};

for (const width of [720, 768, 1000, 1023]) {
  test(`${width}px：頂部 bar 放 root tab，左欄只放行程清單，帳號左下`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/trips');
    await expect(page.getByTestId('trips-list-page')).toBeVisible();

    const tab = page.getByTestId('sidebar-nav-trips');
    await expect(tab).toBeVisible();
    await expect(tab).toHaveAttribute('aria-current', 'page');
    expect((await box(tab)).y).toBeLessThan(56); // 在頂部 bar 內

    // 4 個 tab 同一橫列
    const ys = [];
    for (const k of ['chat', 'trips', 'map', 'favorites']) ys.push((await box(page.getByTestId(`sidebar-nav-${k}`))).y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(2);

    // 左欄 240px，只放行程清單；帳號在左下
    const trips = await box(page.getByTestId('sidebar-trips'));
    expect(trips.x).toBeLessThanOrEqual(12);
    expect(trips.y).toBeGreaterThanOrEqual(56);
    const sidebar = await box(page.getByTestId('desktop-sidebar'));
    expect(sidebar.width).toBeGreaterThanOrEqual(239);
    expect(sidebar.width).toBeLessThanOrEqual(241);
    const acct = page.getByTestId('sidebar-account-card');
    await expect(acct).toBeVisible();
    const a = await box(acct);
    expect(a.x).toBeLessThan(240);
    expect(a.y + a.height).toBeGreaterThan(800 - 80);

    // 無底部膠囊、無右欄、無 header 帳號圓圈
    await expect(page.getByTestId('app-shell-bottom-nav')).toBeHidden();
    await expect(page.getByTestId('app-shell-sheet')).toBeHidden();
    await expect(page.getByTestId('titlebar-account')).toBeHidden();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

for (const width of [768, 1000]) {
  test(`${width}px：選了行程，詳情在內容欄（無右欄）`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/trips?selected=${encodeURIComponent(tripId)}`);
    const portal = page.getByTestId('trip-main-portal');
    await expect(portal).toBeVisible();
    await expect(page.getByTestId('trips-trip-title')).toBeVisible({ timeout: 15000 });
    const p = await box(portal);
    expect(p.x).toBeGreaterThanOrEqual(239);
    expect(p.x + p.width).toBeLessThanOrEqual(width + 1);
    await expect(page.getByTestId('app-shell-sheet')).toBeHidden();
  });
}

test('1024 前後切換：1023 tab 在頂部橫排，1024 回側欄直排＋右欄，719 回手機膠囊', async ({ page }) => {
  await page.setViewportSize({ width: 1023, height: 800 });
  await page.goto('/trips');
  await expect(page.getByTestId('trips-list-page')).toBeVisible();
  expect((await box(page.getByTestId('sidebar-nav-trips'))).y).toBeLessThan(56);

  // 1024–1199：#1708 側欄預設收合（tab 收進切換鈕），右欄出現、不再有頂部 bar
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(page.getByTestId('sidebar-nav-trips')).toBeHidden();
  await expect(page.getByRole('button', { name: '顯示側欄' }).last()).toBeVisible();
  await expect(page.getByTestId('app-shell-bottom-nav')).toBeHidden();

  // ≥1200：側欄展開，tab 直排
  await page.setViewportSize({ width: 1280, height: 800 });
  const chat = await box(page.getByTestId('sidebar-nav-chat'));
  const trips = await box(page.getByTestId('sidebar-nav-trips'));
  expect(trips.y).toBeGreaterThan(chat.y + 20);
  expect((await box(page.getByTestId('desktop-sidebar'))).width).toBeLessThanOrEqual(217);

  await page.setViewportSize({ width: 719, height: 800 });
  await expect(page.getByTestId('desktop-sidebar')).toBeHidden();
  await expect(page.getByTestId('app-shell-bottom-nav')).toBeVisible();
  await expect(page.getByTestId('global-bottom-nav-trips')).toBeVisible();
});

test('768 開行程後跨 1024 放大，內容欄仍在（TripPageHost 不因斷點掉內容）', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto(`/trips?selected=${encodeURIComponent(tripId)}`);
  const portal = page.getByTestId('trip-main-portal');
  await expect(page.getByTestId('trips-trip-title')).toBeVisible({ timeout: 15000 });
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByTestId('trip-main-portal')).toBeVisible();
  await expect(page.getByTestId('trips-trip-title')).toBeVisible();
});
