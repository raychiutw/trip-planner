// @ts-check
/**
 * #1159 · root tab 與 Day tab 的鍵盤焦點指示 —— 真瀏覽器、真鍵盤。
 *
 * 為什麼一定要真鍵盤而不是「檢查 CSS 規則存在」：
 *   1. `:focus-visible` 只在瀏覽器判定為「鍵盤導覽」時才 match。加 class 模擬、或用
 *      `element.focus()` 以外的途徑取得焦點，都可能不觸發它。
 *   2. **規則存在不代表看得到。** ring 是 outset box-shadow，任何祖先的 `overflow: hidden`
 *      都會把它裁掉；也可能被更高特異性的規則蓋掉。這正是本票坑 3 的警告。
 *   3. Day tab 用 ArrowLeft/Right roving tabindex，焦點在 JS 層手動搬移 —— 純 CSS 規則
 *      要搭配真的 focus() 到新項目才會顯示。
 *
 * 斷言方式依票的要求：**看 computed style 有沒有非 none 的 outline 或 box-shadow，
 * 不斷言 class 名稱**（class 改名不該讓守衛紅，指示消失才該紅）。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
  await page.route('**/api/route**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ polyline: [], duration: null, distance: 0, approx: true }),
  }));
});

/**
 * 讀目前聚焦元素的焦點指示。回 { outline, boxShadow, hasIndicator }。
 *
 * `hasIndicator` 刻意寫得保守：`outline-style` 不是 none 且寬度不為 0，**或**
 * box-shadow 不是 none。只要其中一個成立就算有指示 —— 本 repo 的慣例（#1158 立的）
 * 是 `outline: 2px solid var(--color-focus-ring)` + `outline-offset: 2px` + 雙帶內圈
 * （#1182 依 HIG 收斂；先前的 `outline: none; box-shadow: var(--shadow-ring)` 已退場）。
 * 但別把守衛綁死在那一種寫法上 —— 表單輸入走 border-color、清單走 highlight 也算數。
 */
async function focusIndicator(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { target: 'body', hasIndicator: false };
    const s = getComputedStyle(el);
    const outlineOn = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth || '0') > 0;
    const shadowOn = !!s.boxShadow && s.boxShadow !== 'none';
    return {
      target: `${el.tagName}[${el.getAttribute('data-testid') ?? el.className}]`,
      outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`,
      boxShadow: s.boxShadow,
      hasIndicator: outlineOn || shadowOn,
    };
  });
}

test('root tab（底部 4-tab 導覽）鍵盤聚焦時有可見焦點指示', async ({ page }) => {
  // 底部 4-tab 是**手機限定** —— 桌機（≥1024）的主導覽是 sidebar，這個膠囊整個不顯示。
  // 第一版忘了這件事，在 chromium 上等一個永遠不會可見的元素、逾時 30 秒假紅。
  const vp = page.viewportSize();
  test.skip(!vp || vp.width >= 1024, '底部 4-tab 只在 <1024px 顯示，桌機的主導覽是 sidebar');

  await page.goto('/trips');
  await page.getByTestId('app-shell-bottom-nav').waitFor({ state: 'visible' });

  // 直接聚焦 tab 本身（Playwright 的 focus() 會讓瀏覽器把它視為鍵盤焦點 →
  // :focus-visible 會 match，實測比連按 Tab 穿過整頁可靠且不受頁面內容變動影響）。
  const tab = page.getByTestId('global-bottom-nav-map');
  await tab.waitFor({ state: 'visible' });
  await tab.focus();
  await expect(tab).toBeFocused();

  const ind = await focusIndicator(page);
  expect(
    ind.hasIndicator,
    `root tab 聚焦後沒有任何可見焦點指示 —— 純鍵盤使用者不知道自己在哪。實測 ${JSON.stringify(ind)}`,
  ).toBe(true);
});

test('Day tab（roving tabindex）用 Arrow 移動後，新的項目有可見焦點指示', async ({ page }) => {
  // Day tab 是行程明細與地圖共用的日期切換列。用地圖頁：它的 day 膠囊列固定存在。
  await page.goto('/trip/okinawa-trip-2026-Ray/map?day=all');
  await page.waitForLoadState('networkidle');

  const tabs = page.locator('.tp-map-day-tabs');
  await tabs.waitFor({ state: 'visible' });
  // ⚠ 必須等到**至少兩顆** tab。roving 的 useDayStripNav 在 `nextIdx === idx` 時直接
  // return —— day 資料還沒載入時 keys 只有 ['overview'] 一個元素，ArrowRight 會靜默
  // 什麼都不做，測試會誤判成「roving 壞了」。
  // 用 poll 而不是 `not.toHaveCount(1)`：後者在 count 為 **0** 時也會通過（第二版就是
  // 這樣在 mobile-chrome 上假紅的 —— 條件放行後 tab 還沒 render 完）。
  await expect
    .poll(() => tabs.locator('.tp-map-day-tab').count(), { timeout: 10000 })
    .toBeGreaterThanOrEqual(2);
  const first = tabs.locator('.tp-map-day-tab').first();
  await first.focus();
  await expect(first).toBeFocused();

  // 聚焦第一個時就該有指示。
  const before = await focusIndicator(page);
  expect(
    before.hasIndicator,
    `Day tab 聚焦後沒有可見焦點指示。實測 ${JSON.stringify(before)}`,
  ).toBe(true);

  // ⚠ 本票坑 1 的重點：roving tabindex 用 JS 手動搬焦點，CSS 規則存在不代表搬過去後
  // 新項目也會顯示。所以要按 ArrowRight 真的移動一次再量。
  await page.keyboard.press('ArrowRight');
  // ⚠ 必須**等焦點真的搬完**才量。useDayStripNav 是在 requestAnimationFrame 裡 focus()
  // 新項目的（且前面還有一次 onPick 觸發的導覽 + re-render）—— 按完鍵立刻讀 activeElement
  // 是 race：實測 chromium / mobile-safari 剛好來得及、mobile-chrome 就讀到舊的，
  // 於是誤報成「roving 壞了」。用等待式斷言而不是 waitForTimeout 猜時間。
  await expect(
    tabs.locator('[data-testid="map-day-1"]'),
    'ArrowRight 應把焦點移到下一個 day tab（overview → day 1）',
  ).toBeFocused();
  const after = await focusIndicator(page);
  expect(
    after.hasIndicator,
    `ArrowRight 移動後的 Day tab 沒有可見焦點指示 —— roving 焦點管理讓指示沒跟著移動。實測 ${JSON.stringify(after)}`,
  ).toBe(true);
  // 焦點真的換人了才算驗到 roving（沒換就只是重複量同一顆）。
  expect(after.target, `ArrowRight 沒有把焦點移到別的 tab（實測仍在 ${after.target}）`).not.toBe(
    before.target,
  );
});
