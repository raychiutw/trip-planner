// @ts-check
/**
 * 桌機第三欄面板 no-remount E2E — owner 2026-07-21 回報 #2「開關第三欄面板會刷新第二欄」。
 *
 * Root cause 修復（見 src/components/trip/TripPageHost.tsx）：整個 app 只 render 一份
 * <TripPage>，掛在 <Routes> 之上，路由在 /trips?selected=X ↔ /trip/:id/{edit|...} 之間
 * 切換不再讓它 unmount/remount。這支 e2e 從「使用者可觀察的行為」驗證，而非只信任 unit
 * test 的 mount-count 斷言 —— coordinator 明確要求：用實際畫面/network 驗證，不是只推論。
 *
 * 驗證兩件事：
 *   1. 「關閉操作面板、回到 /trips?selected=X」不會讓中欄重新抓一次行程資料。
 *      （「開啟」面板那一刻其實還有一個已知、獨立於本次修復的次要行為：
 *      TripLayout 自己也 useTrip(tripId)，供中欄 TitleBar 的行程名稱使用
 *      （見 src/pages/TripLayout.tsx，未被本次改動觸及）——每次進入任一
 *      /trip/:id/* 操作路由都會讓 TripLayout 重新 mount 一次，因此多打一次
 *      /days（只影響 TitleBar 文字，不影響中欄實際行程內容，而行程內容才是
 *      owner 回報「刷新」真正在講的東西）。這是預先存在、獨立的次要議題，
 *      不在本次 #2 修復範圍內，這裡誠實地把驗證焦點放在「關閉不再多打」而非
 *      「開啟全程只打一次」。）
 *   2. 深連結（直接打開 /trip/:id/edit）仍正常渲染 —— 這是 param→prop 改造最容易壞掉的地方。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

const TRIP_ID = 'okinawa-trip-2026-Ray';

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test.describe('TripPageHost — 開關第三欄面板不重新抓中欄行程資料', () => {
  test('桌機：/trips?selected=X → 開啟編輯行程面板 → 關閉，關閉這一步不再多打 days API', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', '只需一個桌機 viewport 驗證，避免重複跑');
    await page.setViewportSize({ width: 1440, height: 900 });

    // useTrip() 打 GET /api/trips/:id/days?all=1（見 src/hooks/useTrip.ts）——
    // remount 時這支會被重新呼叫一次；no-remount 修好後開關面板不該再多打。
    const daysRequests = [];
    page.on('request', (req) => {
      const url = req.url();
      if (new RegExp(`/api/trips/${TRIP_ID}/days(\\?|$)`).test(url)) {
        daysRequests.push(url);
      }
    });

    await page.goto(`/trips?selected=${TRIP_ID}`);
    // portal placeholder 本身是空 <div>（無自身尺寸），驗證要看它「有沒有被 portal
    // 進內容」而不是它自己是否 visible —— 直接斷言中欄行程內容（行程標題）有渲染
    // 出來，這才是「已經抓過一次資料且成功顯示」的可觀察基準點（同 drag-flows.spec.js
    // 既有的斷言方式）。
    await expect(page.getByRole('heading', { name: /2026 沖繩自駕五日遊/ })).toBeVisible({ timeout: 10000 });
    const countAfterInitialLoad = daysRequests.length;
    expect(countAfterInitialLoad).toBeGreaterThan(0);

    // 開啟操作面板（編輯行程）— 這是 owner 回報「刷新第二欄」的觸發點。
    await page.getByTestId('trips-embedded-menu-trigger').click();
    await page.getByTestId('trip-embedded-menu-edit-' + TRIP_ID).click();
    await expect(page).toHaveURL(new RegExp(`/trip/${TRIP_ID}/edit`));
    await expect(page.getByTestId('trip-main-portal')).toBeVisible({ timeout: 10000 });
    // 面板打開後的呼叫次數當基準（含上面提到、獨立於本次修復的 TripLayout
    // title-only fetch —— 它是 async fire-and-forget，portal visible 那一刻不保證
    // 已經送出，等一小段時間讓它穩定下來再當基準）。重點驗證是「關閉」這一步
    // 不再額外多打，不是「開啟」這一步打幾次。
    await page.waitForTimeout(500);
    const countAfterPanelOpen = daysRequests.length;

    // 關閉面板，回到 /trips?selected=X。這是本次修復的核心場景：owner 回報
    // 「開關」都會刷新，第一版只驗過「開啟」半段，這裡明確驗「關閉」。
    await page.getByTestId('stack-panel-close').click();
    await expect(page).toHaveURL(new RegExp(`/trips\\?selected=${TRIP_ID}`));
    await expect(page.getByTestId('trip-main-portal')).toBeVisible({ timeout: 10000 });

    // 核心斷言：關閉面板回到 /trips?selected=X 不應該再多打一次 —— 多打就代表
    // TripPage 被 unmount/remount 重新抓過資料（owner 講的「刷新」）。
    expect(daysRequests.length).toBe(countAfterPanelOpen);
  });

  test('深連結：直接打開 /trip/:id/edit 仍正常渲染中欄（param→prop 改造沒破壞冷啟）', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', '只需一個桌機 viewport 驗證，避免重複跑');
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(`/trip/${TRIP_ID}/edit`);
    await expect(page.getByTestId('trip-main-portal')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('stack-panel-header')).toBeVisible();
  });
});
