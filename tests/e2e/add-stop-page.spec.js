// @ts-check
/**
 * AddStopPage E2E — Section 3 (terracotta-add-stop-modal mockup)
 *
 * 2026-05-03 modal-to-fullpage migration: 原 AddStopModal 改 /trip/:id/add-stop?day=N
 * 全頁。trigger 從 TitleBar「+ 加景點」按鈕走 navigate，不再 mount portal。
 *
 * 驗 mockup section 14：navigate 後 page render，3 tab (搜尋/收藏/自訂)
 * + 5 subtab + 自訂 form + counter + back via 瀏覽器 history。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test.describe('AddStopPage — Section 3 (modal-to-fullpage migration)', () => {
  test('TripPage TitleBar「加景點」 button → navigate 到 /add-stop?day=N page', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray');
    const trigger = page.getByTestId('trip-add-stop-trigger');
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page).toHaveURL(/\/trip\/okinawa-trip-2026-Ray\/add-stop\?day=\d+/);
    await expect(page.getByTestId('add-stop-page')).toBeVisible();
  });

  test('page 含 3 tab + 5 category subtab', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    await expect(page.getByTestId('add-stop-page')).toBeVisible();
    // 3 tabs
    await expect(page.getByTestId('add-stop-tab-search')).toBeVisible();
    await expect(page.getByTestId('add-stop-tab-saved')).toBeVisible();
    await expect(page.getByTestId('add-stop-tab-custom')).toBeVisible();
    // 5 subtabs (search default tab → 顯示 subtab bar)
    await expect(page.getByTestId('add-stop-subtab-all')).toBeVisible();
    await expect(page.getByTestId('add-stop-subtab-attraction')).toBeVisible();
    await expect(page.getByTestId('add-stop-subtab-food')).toBeVisible();
    await expect(page.getByTestId('add-stop-subtab-hotel')).toBeVisible();
    await expect(page.getByTestId('add-stop-subtab-shopping')).toBeVisible();
  });

  test('region + 主動輸入 → search 顯示「熱門景點 · 沖繩」 + 結果卡', async ({ page }) => {
    // 2026-05-03 modal-to-fullpage migration: 原 modal 有 defaultRegion prop 從
    // trip context 推「沖繩」一打開就 search；改全頁後預設「全部地區」(更中性)，
    // user 自己選 region 觸發 search。
    // PR #459 #9: 拿掉 region auto-fire (Nominatim 1 req/s 限制)，改 user
    // 主動輸入才查。Mock 用 osm_id 90001 cover 「熱門景點 · 沖繩」 path。
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    await expect(page.getByTestId('add-stop-page')).toBeVisible();
    await page.getByTestId('add-stop-region-pill').click();
    await page.getByRole('button', { name: '沖繩' }).click();
    await page.getByTestId('add-stop-search-input').fill('沖繩');
    await expect(page.getByText('熱門景點 · 沖繩')).toBeVisible();
    await expect(page.getByTestId('add-stop-search-card-90001')).toBeVisible();
  });

  test('切到收藏 tab → render 收藏 grid 或 empty state', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    await page.getByTestId('add-stop-tab-saved').click();
    await expect(page.getByText(/還沒收藏景點/)).toBeVisible();
  });

  test('自訂 tab → form fields render + counter 隨 title 更新', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    await page.getByTestId('add-stop-tab-custom').click();
    await expect(page.getByTestId('add-stop-custom-title')).toBeVisible();
    await expect(page.getByTestId('add-stop-custom-time')).toBeVisible();
    await expect(page.getByTestId('add-stop-custom-duration')).toBeVisible();
    await expect(page.getByTestId('add-stop-custom-note')).toBeVisible();
    await expect(page.getByTestId('add-stop-counter')).toContainText('已選');
    await expect(page.getByTestId('add-stop-counter')).toContainText('將加入');
    await page.getByTestId('add-stop-custom-title').fill('海邊散步');
    await expect(page.getByTestId('add-stop-counter')).toContainText('已選 1 個');
  });

  test('自訂 tab 缺 title 點完成 → inline error', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    await page.getByTestId('add-stop-tab-custom').click();
    await page.getByTestId('add-stop-confirm').click();
    await expect(page.getByTestId('add-stop-custom-error')).toBeVisible();
    await expect(page.getByTestId('add-stop-custom-error')).toContainText('請輸入');
  });

  test('TitleBar 返回按鈕 → 回到 trip 頁面', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray');
    await page.getByTestId('trip-add-stop-trigger').click();
    await expect(page.getByTestId('add-stop-page')).toBeVisible();
    // TitleBar 返回 button 用 aria-label 抓 (AddStopPage 設 backLabel="返回前頁")
    await page.getByRole('button', { name: '返回前頁' }).click();
    await expect(page).toHaveURL(/\/trip\/okinawa-trip-2026-Ray$|\/trips/);
  });

  test('subtab 切 food → .is-active 套到該 subtab', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    await expect(page.getByTestId('add-stop-subtab-all')).toHaveClass(/is-active/);
    await page.getByTestId('add-stop-subtab-food').click();
    await expect(page.getByTestId('add-stop-subtab-food')).toHaveClass(/is-active/);
    await expect(page.getByTestId('add-stop-subtab-all')).not.toHaveClass(/is-active/);
  });

  test('TitleBar 完成按鈕 (responsive icon+text/icon-only) 與 bottom bar 同步 disabled', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    // search tab default 0 selected → 兩處 confirm 都 disabled
    const titleBarConfirm = page.getByTestId('add-stop-titlebar-confirm');
    const bottomConfirm = page.getByTestId('add-stop-confirm');
    await expect(titleBarConfirm).toBeDisabled();
    await expect(bottomConfirm).toBeDisabled();
    // switch to custom + fill title → enable
    await page.getByTestId('add-stop-tab-custom').click();
    await page.getByTestId('add-stop-custom-title').fill('測試景點');
    await expect(titleBarConfirm).toBeEnabled();
    await expect(bottomConfirm).toBeEnabled();
  });
});
