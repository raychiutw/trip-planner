// @ts-check
/**
 * AddCustomStopPage E2E — mobile fullpage 自訂景點路徑
 *
 * v2.31.94 設計：mobile (≤1023px) 切自訂 tab → 自動 redirect 到
 * `/trip/:id/add-custom-stop?day=N`（fullpage IME-safe）。本 spec 鎖 mobile
 * 路徑；desktop inline tab 路徑由 add-stop-page.spec.js 覆蓋。
 *
 * Test 跳過 desktop project（add-custom-stop 是 mobile-only route，desktop
 * 開會被 MobileOnlyRoute redirect 到 /trips）。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test.describe('AddCustomStopPage — mobile fullpage', () => {
  test('mobile-only: page render + 4 form fields + confirm disabled until coord set', async ({ page }, testInfo) => {
    // MobileOnlyRoute 只 render ≤1023px viewport。Desktop project (1280×800)
    // 進來會被 redirect 回 /trips；跳 desktop project 避免 false fail。
    testInfo.skip(!testInfo.project.name.startsWith('mobile-'), 'mobile-only route — desktop redirects to /trips');

    await page.goto('/trip/okinawa-trip-2026-Ray/add-custom-stop?day=1');
    await expect(page.getByTestId('add-custom-stop-page')).toBeVisible();

    // 4 form fields render
    await expect(page.getByTestId('add-custom-stop-title')).toBeVisible();
    await expect(page.getByTestId('add-custom-stop-address-typeahead')).toBeVisible();
    await expect(page.getByTestId('add-custom-stop-time')).toBeVisible();
    await expect(page.getByTestId('add-custom-stop-duration')).toBeVisible();
    await expect(page.getByTestId('add-custom-stop-note')).toBeVisible();

    // CI 無 Google Maps key → map fail-load → pickedCoord 永遠 null →
    // 完成 disabled 即使填 title。(對齊 AddStopPage v2.31.94 wedge guard)
    const confirm = page.getByTestId('add-custom-stop-confirm');
    await expect(confirm).toBeDisabled();
    await page.getByTestId('add-custom-stop-title').fill('海邊散步 — mobile QA');
    await expect(confirm).toBeDisabled();
  });

  test('mobile-only: TripTimePicker trigger 顯 --:-- placeholder', async ({ page }, testInfo) => {
    testInfo.skip(!testInfo.project.name.startsWith('mobile-'), 'mobile-only route');

    await page.goto('/trip/okinawa-trip-2026-Ray/add-custom-stop?day=1');
    const timePickerWrap = page.getByTestId('add-custom-stop-time');
    await expect(timePickerWrap).toBeVisible();
    // v2.33.21: native <input type="time"> 換 TripTimePicker (button trigger 顯 --:--)
    const trigger = timePickerWrap.getByRole('button');
    await expect(trigger).toContainText('--:--');
  });

  test('mobile-only: desktop viewport redirects away from /add-custom-stop', async ({ page }, testInfo) => {
    // 反向驗證 — desktop 進 /add-custom-stop 應被 redirect。
    testInfo.skip(testInfo.project.name.startsWith('mobile-'), 'desktop redirect check — skip mobile project');

    await page.goto('/trip/okinawa-trip-2026-Ray/add-custom-stop?day=1');
    // MobileOnlyRoute redirect fallbackPath="/trips"
    await expect(page).toHaveURL(/\/trips($|\?)/);
  });
});
