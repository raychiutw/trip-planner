// @ts-check
/**
 * #1162 · 桌機：換景點面板切換來源分頁後，「‹ 返回上一層」不得消失。
 *
 * 為什麼需要 e2e 而不只是 jsdom 那支：
 *   1. `inStack` 由 `useMediaQuery('(min-width: 1024px)')` 決定 —— 只有真 viewport 算得出來
 *      （jsdom 那支是用 SheetStackProvider 直接注入 inStack 繞過）。
 *   2. `depth = 2` 要來自 `EditEntryPage` 的**真 push**，不是測試手寫的 initialEntries。
 *   3. 查詢字串更新走的是真 history，而 bug 的根因就在 router 的 history/state 語意。
 *
 * 三件事合起來才是使用者真正走的那條路。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

const TRIP_ID = 'okinawa-trip-2026-Ray';
const ENTRY_ID = 101;

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  // 面板頁不需要地圖，但 trip shell 會掛 sticky map；擋掉 Google 才與 CI 同條件
  // （本機 .env.local 有 key，localhost 非授權 referer 會讓地圖崩掉整個 shell）。
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
  await page.route('**/api/route**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ polyline: [], duration: null, distance: 0, approx: true }),
  }));
});

test('切換來源分頁後「返回上一層」仍在（桌機堆疊第二層）', async ({ page }, testInfo) => {
  // 桌機專屬行為：手機 inStack=false，‹ 恆顯、本 bug 不存在。單一 viewport 驗證即可。
  test.skip(testInfo.project.name !== 'chromium', '桌機堆疊行為，單一 viewport 驗證');
  await page.setViewportSize({ width: 1440, height: 900 });

  // 先進編輯景點面板（桌機右欄第一層 L2 → depth 1，只有 ✕）。
  await page.goto(`/trip/${TRIP_ID}/stop/${ENTRY_ID}/edit`);
  const changePoiBtn = page.getByTestId('edit-entry-change-poi');
  await changePoiBtn.waitFor({ state: 'visible', timeout: 15000 });

  // 這一步是關鍵：由 EditEntryPage 真的 push（帶 state.depth = 2）→ 更深一層，該有 ‹。
  await changePoiBtn.click();
  const back = page.getByTestId('stack-panel-back');
  await expect(
    back,
    'push 進換景點面板後應有「‹ 返回上一層」—— 沒有的話後面的斷言什麼都沒驗到',
  ).toBeVisible();

  // 切到「收藏」分頁。修前這一下會把 location.state 清成 null → depth 落回 1 → ‹ 消失。
  await page.getByTestId('change-poi-tab-favorites').click();

  // 先確認分頁真的切了（URL 是最不會騙人的證據），否則下面那條可能只是「什麼都沒發生」。
  await expect(page).toHaveURL(/[?&]tab=favorites\b/);

  await expect(
    back,
    '切分頁後「‹ 返回上一層」消失了 —— 使用者只剩 ✕，回不到編輯景點頁（#1162）',
  ).toBeVisible();

  // 再切一次（自訂），確認不是只有第一次僥倖保住。
  await page.getByTestId('change-poi-tab-custom').click();
  await expect(page).toHaveURL(/[?&]tab=custom\b/);
  await expect(back, '連續切換後 ‹ 仍應在').toBeVisible();
});
