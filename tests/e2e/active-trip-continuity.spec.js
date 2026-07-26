/**
 * #1140 的行為層缺口補測（story 1–3、6）。
 *
 * 票裡的 Testing Decisions 明寫要兩支 e2e：
 *   - trip switcher：「真頁面點標題開下拉、**選另一條切過去**」
 *   - active trip 單一真相：「在 A tab 選行程、**切到 B/C tab 顯示同一條**」
 *
 * 兩者都只做了 unit（`trip-title-switcher.test.tsx` 驗 open/收合/onPick 回呼、
 * `trips-list-page.test.tsx` 驗頁面讀 `activeTripId`），**行為層從來沒有人驗過**：
 * 既有 e2e 只在 `a11y-axe.spec.js` 把下拉打開給 axe 掃，掃完就結束，沒有點選。
 *
 * 為什麼非 e2e 不可：這兩條的價值都在「跨頁後狀態還在」——
 *   - 選行程 → navigate → 新頁面重新解析 activeTripId
 *   - localStorage persist + `window 'storage'` 跨 tab 同步
 * jsdom 的單元測試裡沒有真正的導覽，render 一次就結束，驗不到「換頁後還在」。
 *
 * mock fixture（`api-mocks.js`）給兩條行程，switcher 只在 `trips.length > 1` 時可展開，剛好夠用。
 * id 一律從 fixture 取，不在本檔抄字面值。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST, MOCK_TRIP_META_BUSAN } = require('./api-mocks');

// 從 fixture 取 id，不在這裡再抄一份字面值 —— fixture 的 owner 欄位是人名，
// 多寫一次就多一個要跟著改的地方（pre-push 的 PII 掃描也會多命中一處）。
const TRIP_A = MOCK_TRIPS_LIST[0].tripId;
const TRIP_B = MOCK_TRIPS_LIST[1].tripId;
const TRIP_B_TITLE_FRAGMENT = MOCK_TRIP_META_BUSAN.name.slice(0, 2); // 「釜山」

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  // 與 a11y-axe.spec.js 同一組理由：本機 .env.local 有 Google Maps key，不擋就會打真 API
  // 而 localhost 非授權 referer；CI 無 key 時 useGoogleMap 直接 setLoadError。擋掉＝與 CI 同條件。
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
  await page.route('**/api/route**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ polyline: [], duration: null, distance: 0, approx: true }),
  }));
});

test('#1140 story 6：trip switcher 選另一條行程 → 畫面真的切過去', async ({ page }) => {
  // 不能用 /map：GlobalMapPage 有 trips 時會無條件轉址到 /trip/:id/map。
  await page.goto(`/trip/${TRIP_A}/map?day=all`);
  await page.waitForLoadState('networkidle');

  await page.getByTestId('map-trip-title').click();
  const pickB = page.getByTestId(`map-trip-pick-${TRIP_B}`);
  await expect(pickB, 'switcher 下拉裡應該列出另一條行程').toBeVisible();
  await pickB.click();

  // 「真的切過去」＝ URL 換到 B。只驗標題文字不夠 —— 標題是 switcher 自己 render 的，
  // 它可以在 route 沒動的情況下就換掉文字（那就是 bug 而不是修好）。
  await expect(page, '選了另一條行程後 URL 應指向該行程').toHaveURL(new RegExp(`/trip/${TRIP_B}/`));
  // 下拉應收合（W6 行為，unit 也驗過，這裡確認真頁面上一致）
  await expect(page.getByTestId(`map-trip-pick-${TRIP_B}`)).toBeHidden();
});

test('#1140 story 1–3：切 tab 帶著同一個 active trip，重整後仍在', async ({ page }) => {
  await page.goto(`/trip/${TRIP_A}/map?day=all`);
  await page.waitForLoadState('networkidle');

  // 在地圖 tab 切到 B
  await page.getByTestId('map-trip-title').click();
  await page.getByTestId(`map-trip-pick-${TRIP_B}`).click();
  await expect(page).toHaveURL(new RegExp(`/trip/${TRIP_B}/`));

  /*
   * ⚠ **不能只等 URL 換掉就往下走。** URL 一變 `toHaveURL` 就通過，但把 active trip 寫進
   * localStorage 的是 `MapPage` 在**新頁面 render 之後**的 effect —— 兩者之間有一段窗口。
   * 在那段窗口裡 `page.goto('/chat')` 會讓寫入根本沒發生，聊天頁就讀到舊的那條。
   *
   * 這正是本檔第一版的 bug：機器空閒時窗口小、看起來是綠的；與 playwright 另一份同時跑時
   * 就紅（2026-07-26 實測重現）。等「真正的前置條件」而不是等一個剛好比較早發生的信號。
   */
  const LS_KEY = 'tp-trip-pref'; // LS_PREFIX('tp-') + LS_KEY_TRIP_PREF('trip-pref')
  await expect
    .poll(() => page.evaluate((k) => localStorage.getItem(k), LS_KEY), { timeout: 10000 })
    .toContain(TRIP_B);

  // 走到聊天 tab（不帶 tripId）—— 應該解析到 active trip = B，不是回到預設的 A
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByTestId('chat-trip-title'),
    '切到聊天 tab 後應仍是剛選的那條行程（active trip 貫穿），不是退回預設',
  ).toContainText(TRIP_B_TITLE_FRAGMENT);

  // 重整（story 3：回訪仍回到上次選的 active trip）—— persist 在 localStorage `trip-pref`
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByTestId('chat-trip-title'),
    '重整後應仍是同一條行程（localStorage persist）',
  ).toContainText(TRIP_B_TITLE_FRAGMENT);
});
