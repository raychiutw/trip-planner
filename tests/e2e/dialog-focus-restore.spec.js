// @ts-check
/**
 * #1160 · 對話框關閉後焦點回到觸發元素 —— 真瀏覽器、真鍵盤。
 *
 * 為什麼不只靠 tests/unit/confirm-modal-a11y.test.tsx：那支跑在 jsdom，用
 * `element.focus()` 直接指派焦點。jsdom 的焦點模型是簡化版 —— 它不會實作
 * 「元素從 DOM 移除後焦點掉到 body」、也沒有真正的 Tab 順序。焦點還原這種
 * 行為要在真引擎上驗才算數（票的完成判準也寫「手動操作一個刪除流程確認」，
 * 這支就是那個手動步驟的可重複版）。
 *
 * 這裡刻意**全程用鍵盤**（Tab / Enter / Escape），不用 mouse click：
 * 滑鼠點擊本身就會把焦點放到被點的元素上，等於幫測試作弊 —— 焦點「回到」
 * 觸發元素可能只是因為剛才點過它，而不是引擎真的還原了。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test('ConfirmModal：Escape 關閉後焦點回到觸發它的按鈕（不是掉回 body）', async ({ page }) => {
  // 用 /settings/sessions 的「登出其他裝置」當觸發元素：mock 的 MOCK_SESSIONS 本來就有
  // 一筆「非目前」工作階段（sid 'iphone'），該按鈕因此無條件 render，不需要任何前置操作。
  // （原本想用 /favorites 的批次刪除，但 api-mocks 的 initialSavedPois() 回空陣列 ——
  //   收藏頁預設沒有卡片、也就沒有勾選框與刪除鈕，要先跑一次收藏流程才行。）
  await page.goto('/settings/sessions');
  await page.getByTestId('sessions-row-current').waitFor({ state: 'visible' });
  const trigger = page.getByTestId('sessions-revoke-all');
  await expect(trigger).toBeEnabled();

  // 用鍵盤把焦點放到觸發鈕上，再用 Enter 開啟 —— 不用 click（見檔頭說明）。
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');

  const dialog = page.getByTestId('confirm-modal');
  await expect(dialog).toBeVisible();
  // 既有 W12 行為：破壞性動作的預設焦點在安全（取消）鈕，不該被 #1160 改掉。
  await expect(page.getByTestId('confirm-modal-cancel')).toBeFocused();

  // Escape 取消（不是確認 —— 確認會刪掉那張卡，連帶讓觸發鈕消失，那是另一種情境）。
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // #1160 的核心斷言：焦點回到觸發鈕。修好前這裡是 <body>。
  await expect(
    trigger,
    '關閉對話框後焦點應回到觸發它的按鈕；掉到 body 代表鍵盤使用者要重新 Tab 一遍',
  ).toBeFocused();
});

test('ConfirmModal：關閉後可以直接繼續用鍵盤操作（焦點真的可用，不只是掛在那）', async ({ page }) => {
  // 「焦點回到觸發元素」若只是 activeElement 對了但實際不可互動，等於沒修好。
  // 這支用 Enter 再開一次來證明它真的活著 —— 也順帶驗證重複開關不會累積壞掉。
  await page.goto('/settings/sessions');
  await page.getByTestId('sessions-row-current').waitFor({ state: 'visible' });

  const trigger = page.getByTestId('sessions-revoke-all');
  await trigger.focus();
  const dialog = page.getByTestId('confirm-modal');

  for (const round of [1, 2]) {
    await page.keyboard.press('Enter');
    await expect(dialog, `第 ${round} 次應開得起來`).toBeVisible();
    // ⚠ 必須等焦點**真的移進對話框**才按 Escape。第一版少了這一步 → mutation 實測發現
    // 它是假綠：引擎的焦點還原被拔掉後這支照樣通過，因為 Escape 在
    // requestAnimationFrame 把焦點搬進 cancel 鈕**之前**就送出了，焦點從來沒離開觸發鈕，
    // 「還原」自然無事可證。dialog 可見 ≠ 焦點已進去，兩者之間有一個 frame 的空隙。
    await expect(
      page.getByTestId('confirm-modal-cancel'),
      `第 ${round} 次：焦點應先進到對話框，否則後面的「還原」什麼都沒驗到`,
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog, `第 ${round} 次應關得掉`).toBeHidden();
    await expect(trigger, `第 ${round} 次關閉後焦點應回到觸發鈕`).toBeFocused();
  }
});
