// @ts-check
/**
 * 桌機第三欄 scroll 保持 + sheet portal 重接 E2E — 兩個 HIGH 回歸鎖。
 *
 * 背景：TripPage 單例化（TripPageHost，見 trip-stack-no-remount.spec.js）後引入兩個
 * 靜默回歸，靜態審查抓到、實測確認：
 *   A) 開/關操作面板時 .app-shell-main 換新 DOM、scrollTop 歸零，但單例 TripPage 的初始
 *      捲動 effect 因 initialScrollDone latch 不再跑 → 中欄跳回頂端。
 *      修法：TripPage.tsx 監看 portalNode 變更補還原 + rememberScroll listener 重綁新容器。
 *   B) sheet portal（#trip-sheet-portal 桌機 sticky map）用 mount-once getElementById，
 *      單例不 remount → host 換掉後 sheetPortalNode 指向脫離節點 / 卡 null、map 消失。
 *      修法：portalNode 納入 sheet lookup deps，host 換掉時重查。
 *
 * ⚠️ 為何沒有「從 /trips?selected=X 開/關操作面板」這條的 e2e：只要中欄顯示 sticky map，
 * 本機（有 Google Maps key 但 localhost referer 受限）Google 的 main.js 會在 map init 時
 * 內部 throw（RefererNotAllowedMapError → IntersectionObserver observe 崩），整頁進 error
 * boundary（project_local_dev_gmaps_referer_crash，例外 stack 落在 maps.googleapis.com，
 * 非 code bug）→ 本機無法可靠跑到斷言。改由 B2 從「深連結 /edit → 關閉回 /trips?selected」
 * 覆蓋同一條重接機制（portalNode 變更 → 重查 getElementById）：沒有 Fix B 時，深連結 mount
 * 抓到的 sheetPortalNode 是 null 且被鎖死，關閉回列表後 sheet 永遠不出現；有 Fix B 則重查
 * 命中、sheet 顯示。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

const TRIP_ID = 'okinawa-trip-2026-Ray';
const sheetChildCount = (page) =>
  page.locator('#trip-sheet-portal').evaluate((el) => el.childElementCount).catch(() => 0);

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test.describe('桌機第三欄 — scroll 保持 + sheet portal 重接（HIGH 回歸鎖）', () => {
  test('B2: 深連結進 /edit → 關閉回 /trips?selected 也能顯示 sheet（sheet portal 重接）', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', '桌機行為，單一 viewport 驗證');
    await page.setViewportSize({ width: 1440, height: 900 });
    // 深連結先進 operation route（此時 TripsListPage 未掛、無 #trip-sheet-portal）→
    // sheet 首次 lookup 抓到 null。修復前 mount-once 鎖死；修復後 portalNode 變更重查。
    await page.goto(`/trip/${TRIP_ID}/edit`);
    await expect(page.getByTestId('trip-main-portal')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('stack-panel-close').click();
    await expect(page).toHaveURL(new RegExp(`/trips\\?selected=${TRIP_ID}`));
    // 修復前：sheetPortalNode 卡 null → 永遠 0（map 不出現）。修復後重查 → > 0。
    await expect.poll(() => sheetChildCount(page), { timeout: 10000 }).toBeGreaterThan(0);
  });

  test('A: 開操作面板後中欄捲動位置保持（不跳回頂端）', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', '桌機行為，單一 viewport 驗證');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/trips?selected=${TRIP_ID}`);
    await expect(page.getByTestId('trip-main-portal')).toBeVisible({ timeout: 10000 });

    const main = page.locator('.app-shell-main').first();
    await main.evaluate((el) => { el.scrollTop = 250; });
    await page.waitForTimeout(250); // 讓 rememberScroll 的 rAF listener 記下位置
    const scrolled = await main.evaluate((el) => el.scrollTop);
    test.skip(scrolled < 40, `mock 內容不足以捲動（scrollTop=${scrolled}），跳過捲動保持驗證`);

    await page.getByTestId('trips-embedded-menu-trigger').click();
    await page.getByTestId(`trip-embedded-menu-edit-${TRIP_ID}`).click();
    await expect(page).toHaveURL(new RegExp(`/trip/${TRIP_ID}/edit`));
    await expect(page.getByTestId('trip-main-portal')).toBeVisible({ timeout: 10000 });

    // 中欄新 .app-shell-main 應被還原到接近原位（非 0）。restoreScrollTo 有 bounded retry，
    // 用 poll 給它時間；容忍 100px 誤差（內容 async 長高、rAF 讓位）。
    await expect
      .poll(() => page.locator('.app-shell-main').first().evaluate((el) => el.scrollTop), { timeout: 6000 })
      .toBeGreaterThan(scrolled - 100);
  });
});
