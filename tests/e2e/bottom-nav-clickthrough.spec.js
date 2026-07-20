// @ts-check
/**
 * 底部浮動膠囊 — 點擊攔截回歸守護
 *
 * 為什麼需要這支：`.app-shell-bottom-nav` 是 `position: fixed` overlay，浮在內容之上
 * （功能頁全版鋪到底，內容從膠囊下方流過）。歷史上同型事故發生**兩次**：
 *
 *   (a) form confirm button 被 bottom-nav 攔截 —— 22+ 次 master CI e2e flake
 *   (b) v2.56.12 地圖頁底部 POI 卡按不動：
 *       "<a class=tp-global-bottom-nav-btn> from <nav class=app-shell-bottom-nav>
 *        subtree intercepts pointer events"
 *
 * 兩次都靠 `pointer-events: none` 收場，但**都沒留回歸測試**。Regular Glass 收斂
 * （2026-07-20）把材質裝回膠囊、移除了那個 hack，等於重新武裝這兩個事故。
 *
 * (b) 已由 map-bottom-tabs.spec.js 的 firstCard.click() 間接覆蓋；本檔補 (a)，
 * 並把「膠囊不吃事件」這件事變成顯式斷言而非副作用。
 *
 * 註：Playwright 的 click() 在目標被其他元素蓋住時會拋
 * "element intercepts pointer events"，所以不需要額外斷言 —— click 成功即證明沒被攔截。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

// 膠囊只在 <1024 顯示（桌機 primary nav 在 sidebar），所以一律用手機 viewport。
const MOBILE = { width: 390, height: 844 };

/**
 * 斷言 `selector` 的可視中心點沒有被底部膠囊蓋住。
 *
 * 比 `click()` 精準：click 會因為元素 disabled（表單未填）、地圖圖磚載不到等
 * **與遮擋無關**的原因失敗，測不到我們要測的東西。elementFromPoint 直接回答
 * 「使用者點這個位置，瀏覽器會把事件送給誰」—— 那正是兩次事故的形狀。
 */
async function expectNotCoveredByCapsule(page, selector) {
  const result = await page.evaluate((sel) => {
    const target = document.querySelector(sel);
    if (!target) return { ok: false, reason: `找不到 ${sel}` };
    const box = target.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return { ok: false, reason: `${sel} 尺寸為 0` };
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (!hit) return { ok: false, reason: `(${x},${y}) 沒有命中任何元素` };
    const capsule = hit.closest('[data-testid="global-bottom-nav"], .app-shell-bottom-nav');
    return {
      ok: !capsule,
      reason: capsule ? `${sel} 中心點被膠囊攔截（命中 ${hit.tagName}.${hit.className}）` : 'ok',
    };
  }, selector);
  expect(result.ok, result.reason).toBe(true);
}


test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  await page.setViewportSize(MOBILE);
});

test.describe('底部膠囊不攔截下方內容的點擊', () => {
  test('地圖頁：day tab 不被膠囊蓋住（v2.56.12 事故形狀）', async ({ page }) => {
    await page.route('**/api/route**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ polyline: [], duration: null, distance: 0, approx: true }),
      });
    });
    await page.goto('/trip/okinawa-trip-2026-Ray/map?day=all');

    await expect(page.getByTestId('global-bottom-nav')).toBeVisible();
    await expect(page.getByRole('navigation', { name: '行程日期' })).toBeVisible();

    // 不用 click —— 測試環境的地圖圖磚載不到（顯示「地圖暫停服務」），
    // click 會因為重繪不穩定而 timeout，那與遮擋無關。
    await expectNotCoveredByCapsule(page, '[aria-label="行程日期"]');
  });

  test('膠囊本身的 tab 仍可點（移除 pointer-events 不可誤傷導覽）', async ({ page }) => {
    await page.goto('/trips');

    const mapTab = page.getByTestId('global-bottom-nav-map');
    await expect(mapTab).toBeVisible();
    await mapTab.click({ timeout: 5000 });
    await expect(page).toHaveURL(/\/map/);
  });

  test('膠囊常駐：捲動後仍可見（owner 2026-07-20 決定，不實作 HIG minimize）', async ({ page }) => {
    await page.goto('/trips');

    const capsule = page.getByTestId('global-bottom-nav');
    await expect(capsule).toBeVisible();

    // 舊行為是「向下捲動隱藏」（translateY(180%)）。移除後任何捲動量都不該讓它消失。
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(400); // 舊 transition 250ms，留裕度確保不是還沒動完
    await expect(capsule).toBeVisible();
    await expect(capsule).toBeInViewport();
  });

  test('表單頁：送出鍵不被膠囊蓋住（事故 (a) —— 22+ 次 master CI flake 的原型）', async ({ page }) => {
    // 這支才是 docstring 承諾的 (a)。前面地圖那支是 (b)。
    // `.tp-page-bottom-bar` z=210 應勝過膠囊 z=200；若哪天有人動了 z 序或膠囊尺寸，
    // 這裡會直接紅，而不是變成偶發 CI flake。
    await page.goto('/trips/new');

    await expect(page.getByTestId('global-bottom-nav')).toBeVisible();
    await expect(page.locator('.tp-page-bottom-bar')).toBeVisible();

    // 用幾何而非 click：送出鍵在表單填完前是 disabled，click 會因此失敗 ——
    // 那與「有沒有被膠囊蓋住」無關。
    await expectNotCoveredByCapsule(page, '[data-testid="new-trip-submit"]');
  });

  test('/map：膠囊不被底部卡片堆疊埋掉（膠囊「地圖」tab 導向的頁面）', async ({ page }) => {
    // `.tp-global-map-mobile-stack` 是 z-index 700 的**不透明**奶油漸層，原本 bottom: 0
    // 會把 z=200 的膠囊整個蓋住 —— 進到 /map 後就無法用 tab 切回其他頁。
    // 它現在吃 --nav-overlay-h 讓位。
    await page.goto('/map');

    const capsule = page.getByTestId('global-bottom-nav');
    await expect(capsule).toBeVisible();

    // ⚠ 不要只用 toBeVisible / toBeInViewport —— 兩者都**不檢查遮擋**，被不透明元素
    //   完全蓋住時仍然通過。要驗遮擋只能問「膠囊自己的中心點，事件會送給誰」。
    //
    // ⚠ 但本機/CI 沒有 Maps API key，地圖載不到 → `.tp-global-map-mobile-stack`
    //   不會 render，遮擋條件根本不成立。此時**明確 skip**，不要讓它假綠 ——
    //   實測過：把修復還原，用 toBeVisible/toBeInViewport 甚至 elementFromPoint
    //   都照樣通過，因為蓋在上面的東西不存在。假綠比沒測更糟，它宣稱了沒有的覆蓋。
    const probe = await page.evaluate(() => {
      const stack = document.querySelector('.tp-global-map-mobile-stack');
      const el = document.querySelector('[data-testid="global-bottom-nav"]');
      if (!stack || stack.getBoundingClientRect().height === 0) return { rendered: false };
      const box = el.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return {
        rendered: true,
        ok: !!hit && (el === hit || el.contains(hit)),
        reason: hit ? `膠囊被 ${hit.tagName}.${hit.className} 蓋住` : '中心點未命中任何元素',
      };
    });

    test.skip(!probe.rendered, '地圖圖磚未載入 → 卡片堆疊未 render，遮擋條件不成立（需真機/有 API key 的環境驗證）');
    expect(probe.ok, probe.reason).toBe(true);
  });
});
