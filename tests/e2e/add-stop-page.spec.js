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
  test('AddStopPage 直接 URL 進入（v2.23.7：trip TitleBar 從「加景點」改「探索」，AddStopPage 仍 deep-link reachable）', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    await expect(page.getByTestId('add-stop-page')).toBeVisible();
  });

  test('page 含 3 tab + 5 category subtab', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    await expect(page.getByTestId('add-stop-page')).toBeVisible();
    // 3 tabs
    await expect(page.getByTestId('add-stop-tab-search')).toBeVisible();
    await expect(page.getByTestId('add-stop-tab-favorites')).toBeVisible();
    await expect(page.getByTestId('add-stop-tab-custom')).toBeVisible();
    // 5 subtabs (search default tab → 顯示 subtab bar)
    await expect(page.getByTestId('add-stop-subtab-all')).toBeVisible();
    await expect(page.getByTestId('add-stop-subtab-attraction')).toBeVisible();
    await expect(page.getByTestId('add-stop-subtab-food')).toBeVisible();
    await expect(page.getByTestId('add-stop-subtab-hotel')).toBeVisible();
    await expect(page.getByTestId('add-stop-subtab-shopping')).toBeVisible();
  });

  test('region + 主動輸入 → search 顯示「搜尋結果 · 沖繩」 + 結果卡', async ({ page }) => {
    // 2026-05-03 modal-to-fullpage migration: 原 modal 有 defaultRegion prop 從
    // trip context 推「沖繩」一打開就 search；改全頁後預設「全部地區」(更中性)，
    // user 自己選 region 觸發 search。
    // PR #459 #9: 拿掉 region auto-fire (Nominatim 1 req/s 限制)，改 user
    // 主動輸入才查。Mock 用 place_id ChIJPZ5hUjH65DQR_p_dD3CmCOo cover 搜尋結果 path。
    // v2.31.10: section title 條件化 — `query.length >= 2 ? '搜尋結果' : '熱門景點'`，
    // 搜尋態應顯「搜尋結果 · {region}」。
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    await expect(page.getByTestId('add-stop-page')).toBeVisible();
    await page.getByTestId('add-stop-region-pill').click();
    await page.getByRole('button', { name: '沖繩' }).click();
    await page.getByTestId('add-stop-search-input').fill('沖繩');
    await expect(page.getByText('搜尋結果 · 沖繩')).toBeVisible();
    await expect(page.getByTestId('add-stop-search-card-ChIJPZ5hUjH65DQR_p_dD3CmCOo')).toBeVisible();
  });

  test('切到收藏 tab → render 收藏 grid 或 empty state', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    await page.getByTestId('add-stop-tab-favorites').click();
    await expect(page.getByText(/還沒收藏景點/)).toBeVisible();
  });

  test('自訂 tab → form fields render + counter 顯示「已選 0 個」直到 title + coord 雙備齊', async ({ page }, testInfo) => {
    // v2.31.94 設計：mobile (≤1023px) 切自訂 tab → 自動 redirect 到 /add-custom-stop
    // (fullpage IME-safe 路徑)，testid 改 add-custom-stop-* 不是 add-stop-custom-*。
    // 本 spec 鎖 desktop inline tab 路徑；mobile 由 add-custom-stop-*.spec 覆蓋。
    testInfo.skip(testInfo.project.name.startsWith('mobile-'), 'desktop-only inline tab; mobile uses /add-custom-stop fullpage');
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    await page.getByTestId('add-stop-tab-custom').click();
    await expect(page.getByTestId('add-stop-custom-title')).toBeVisible();
    await expect(page.getByTestId('add-stop-custom-time')).toBeVisible();
    await expect(page.getByTestId('add-stop-custom-duration')).toBeVisible();
    await expect(page.getByTestId('add-stop-custom-note')).toBeVisible();
    await expect(page.getByTestId('add-stop-counter')).toContainText('已選');
    // v2.31.33: counter 簡化為「已選 N 個 → DAY NN」(mobile fit)，不再含「將加入」
    await expect(page.getByTestId('add-stop-counter')).toContainText('DAY');
    // v2.31.94: title-only 不再 enable (counter 維持 0)，必須再有 map pin coord 才算 1
    await page.getByTestId('add-stop-custom-title').fill('海邊散步');
    await expect(page.getByTestId('add-stop-counter')).toContainText('已選 0 個');
  });

  test('自訂 tab disabled 直到 title 填 + map pin coord 備齊（v2.31.94 wedge）', async ({ page }, testInfo) => {
    testInfo.skip(testInfo.project.name.startsWith('mobile-'), 'desktop-only inline tab; mobile uses /add-custom-stop fullpage');
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    await page.getByTestId('add-stop-tab-custom').click();
    // Title 空 + 無 coord → 完成 disabled
    const bottomConfirm = page.getByTestId('add-stop-confirm');
    await expect(bottomConfirm).toBeDisabled();
    // Fill title → 仍 disabled（缺 coord）
    await page.getByTestId('add-stop-custom-title').fill('海邊散步');
    await expect(bottomConfirm).toBeDisabled();
  });

  test('TitleBar 返回按鈕 → 回到 trip 頁面', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray');
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    await expect(page.getByTestId('add-stop-page')).toBeVisible();
    // rev2「6 條全接」+ F9：桌機 add-stop 是右欄 stack **第一層(L2)** → 只有「✕ 整個關閉」
    // (stack-panel-close)、不給「‹」；手機全頁 drill-down 則 ‹+✕ 都在。用條件式：有 back(‹) 就
    // 點 back，否則(桌機 L2)點 close(✕) —— 避免手機兩者並存時 .or() 匹配到 2 個。兩者皆回 trip 頁。
    const backBtn = page
      .getByRole('button', { name: '返回前頁' })
      .or(page.getByRole('button', { name: '返回上一層' }));
    if (await backBtn.count() > 0) {
      await backBtn.first().click();
    } else {
      await page.getByTestId('stack-panel-close').click();
    }
    await expect(page).toHaveURL(/\/trip\/okinawa-trip-2026-Ray$|\/trips/);
  });

  test('subtab 切 food → .is-active 套到該 subtab', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    await expect(page.getByTestId('add-stop-subtab-all')).toHaveClass(/is-active/);
    await page.getByTestId('add-stop-subtab-food').click();
    await expect(page.getByTestId('add-stop-subtab-food')).toHaveClass(/is-active/);
    await expect(page.getByTestId('add-stop-subtab-all')).not.toHaveClass(/is-active/);
  });

  test('完成按鈕（bottom bar，stack 模式唯一 confirm 入口）nothing-selected 時 disabled', async ({ page }, testInfo) => {
    testInfo.skip(testInfo.project.name.startsWith('mobile-'), 'desktop-only inline tab; mobile uses /add-custom-stop fullpage');
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    // rev2「6 條全接」：桌機 add-stop 改右欄 stack panel → StackPanelHeader 無 titlebar
    // confirm，完成唯一入口是 bottom bar。search tab default 0 selected → disabled。
    const bottomConfirm = page.getByTestId('add-stop-confirm');
    await expect(bottomConfirm).toBeDisabled();
    // v2.31.94 wedge：自訂 tab 即使 title 填了，map pin coord 沒備齊（CI 無 Google
    // Maps browser key → 地圖 fail load → coord 永遠 null）→ confirm 維持 disabled
    await page.getByTestId('add-stop-tab-custom').click();
    await page.getByTestId('add-stop-custom-title').fill('測試景點');
    await expect(bottomConfirm).toBeDisabled();
  });
});
