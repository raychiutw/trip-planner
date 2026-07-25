// @ts-check
/**
 * W15 · Accessibility 守衛 — axe-core 自動掃描 key 頁面。
 *
 * HIG a11y 收網（依賴 W1 4-tab/帳號 sheet、W4 色彩對比、W11 表單）。用 axe-core 對主要
 * 頁面跑無障礙稽核，鎖住 serious/critical 違規不得出現（防未來 regress）。
 *
 * 掃描範圍：mockable 的 key 頁（行程一覽 / 收藏 / 帳號 + 帳號 sheet）。地圖（Google Maps
 * referer/第三方 canvas）與聊天（後端串流）在 e2e 環境不穩，另計；此守衛先鎖住結構穩定、
 * a11y 最該顧的清單/表單/導覽面。
 *
 * axe 注入：page.addScriptTag(require.resolve('axe-core')) → window.axe.run(document)。
 *
 * #1154 根因記錄：/trips 本來就在上面的 PAGES 掃描清單裡，但守衛只驗「goto + networkidle」
 * 後的預設頁面狀態 —— 兩類已知的柔褐對比違規要靠「使用者互動觸發的狀態」才會出現在
 * DOM／被瀏覽器套上對應樣式，預設狀態掃不到不代表沒違規：
 *   (a) 「新增行程」trailing 卡只在 `:hover` 偽類才換成淡 tint 底 + 深色前景文字，
 *       CSS 選擇器不觸發就不會被 axe 抓到對比（需真滑鼠 hover，不能用 class 模擬）。
 *   (b) 「已封存」分類篩選出的重設按鈕（回到全部）只在該分類結果為零筆時才 render，
 *       預設頁面（全部分類）走不到那個條件分支，DOM 裡根本沒有這個節點。
 * 下面兩支場景各自主動觸發該狀態再掃描，不是把頁面加進掃描清單 —— 頁面本來就在清單裡。
 * 兩處對比已由 #1156 修好，原本的 test.fail()「預期失敗」標記隨之移除。
 *
 * ⚠ 這支守衛有一個已知盲區：axe 的 color-contrast 規則對「內容恰好 1 個字元」的元素
 *   一律歸到 incomplete 而非 violations（axe-core: visibleText.length === 1 →
 *   messageKey: shortTextContent，"Element content is too short to determine if it
 *   is actual text content"），而本檔只讀 results.violations。行程一覽頁的分類 tab
 *   計數徽章在行程數 ≤9 時就是這種元素 —— 實測 3.24:1 確實違規卻掃不出來，滿 10 筆
 *   變兩位數才掃得到。也就是說這裡的綠會隨 mock 資料量飄。那一類 call-site 要靠
 *   tests/unit/trips-list-accent-text.test.ts 守，別以為 e2e 全綠就代表沒有對比違規。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');
const axePath = require.resolve('axe-core');

const PAGES = [
  { name: 'trips', path: '/trips' },
  { name: 'favorites', path: '/favorites' },
  { name: 'account', path: '/account' },
];

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

/** 跑 axe，回 serious/critical 違規（精簡欄位）。 */
async function scanSeriousCritical(page) {
  await page.addScriptTag({ path: axePath });
  const results = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    return await window.axe.run(document, {
      resultTypes: ['violations'],
      // 排除第三方 widget 容器（地圖 canvas 等）—— 非我方 markup。
      exclude: [['.gm-style'], ['iframe']],
    });
  });
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      detail: v.nodes.slice(0, 4).map((n) => ({
        target: n.target.join(' '),
        data: (n.any && n.any[0] && n.any[0].data) || null,
      })),
    }));
}

for (const p of PAGES) {
  test(`a11y: ${p.name} 無 serious/critical axe 違規`, async ({ page }) => {
    await page.goto(p.path);
    await page.waitForLoadState('networkidle');
    const bad = await scanSeriousCritical(page);
    if (bad.length) {
      // eslint-disable-next-line no-console
      console.log(`\n[a11y ${p.name}] serious/critical:\n` + JSON.stringify(bad, null, 2));
    }
    expect(bad, `${p.name} 有 serious/critical a11y 違規`).toEqual([]);
  });
}

// #1154（收網 #1150 to-tickets 拆解）：既有掃描只驗「預設頁面狀態」，漏掉兩類
// call-site 違規 —— 元素本身確實在掃描清單頁（/trips）內，但要靠 :hover 偽類或
// 特定篩選結果（空清單）才會渲染/切色，預設 goto+networkidle 永遠碰不到。
// 下面兩支場景刻意「主動觸發」該狀態再掃。兩處對比與 test.fail() 的處置見檔頭。
// 註：hover 卡那支原本被 #1154 標成「追蹤於 #1155」，是標錯了 —— #1155 是「擴大掃描
// 到其他頁面」，不含修色；「新增行程」卡的 hover 文字明列在 #1156 的範圍裡。

test('a11y: 「新增行程」卡 hover 態（真滑鼠移入）無 serious/critical 違規', async ({ page }) => {
  await page.goto('/trips');
  await page.waitForLoadState('networkidle');
  // 用真的滑鼠移入觸發 :hover 偽類（非加 class 模擬）—— page.hover() 送真實 mousemove。
  await page.getByTestId('trips-list-new-trip-card').hover();
  await page.waitForTimeout(50);
  const bad = await scanSeriousCritical(page);
  if (bad.length) {
    // eslint-disable-next-line no-console
    console.log('\n[a11y trips new-trip-card hover] serious/critical:\n' + JSON.stringify(bad, null, 2));
  }
  expect(bad, 'trips 新增行程卡 hover 態有 serious/critical a11y 違規').toEqual([]);
});

test('a11y: 「已封存」分類篩選結果為零時的重設按鈕無 serious/critical 違規', async ({ page }) => {
  await page.goto('/trips');
  await page.waitForLoadState('networkidle');
  // mock 帳號的兩筆行程都沒有 archivedAt，切到「已封存」分類必為空清單 → 觸發 reset 按鈕渲染。
  await page.getByTestId('trips-list-tab-archived').click();
  await page.getByTestId('trips-list-archived-reset').waitFor({ state: 'visible' });
  const bad = await scanSeriousCritical(page);
  if (bad.length) {
    // eslint-disable-next-line no-console
    console.log('\n[a11y trips archived-empty reset] serious/critical:\n' + JSON.stringify(bad, null, 2));
  }
  expect(bad, 'trips 已封存空清單 reset 按鈕有 serious/critical a11y 違規').toEqual([]);
});

test('a11y: 帳號 sheet（帳號圓圈開啟）無 serious/critical axe 違規', async ({ page }) => {
  await page.goto('/trips');
  await page.waitForLoadState('networkidle');
  // 帳號入口每個 form factor 各一顆，另一顆由 CSS 藏起來：手機是 header 圓圈
  // （AccountCircle 的 `titlebar-account`，.tp-account-circle 在 ≥1024 display:none），
  // 桌機是側欄左下 chip（DesktopSidebar 的 `sidebar-account-card`）。兩顆都在 DOM 裡。
  //
  // ⚠ 這裡不能用 `.first()`：`.or()` 是**按 DOM 順序**挑，不是「挑第一個有 match 的
  // locator」。手機視窗下 DOM 裡先出現的是隱藏的桌機 chip → click 永遠等不到 visible，
  // 30s 逾時（master 連紅 30 小時的根因，另一半是原本寫的 `account-circle` 這個 testid
  // 在 src/ 根本不存在，於是 `.or()` 每次都只剩桌機那顆）。必須 filter visible。
  const trigger = page
    .getByTestId('titlebar-account')
    .or(page.getByTestId('sidebar-account-card'))
    .filter({ visible: true });
  // 恰好一顆：0 顆代表 testid 又漂了（原本的 `if (count)` 會直接跳過互動、只掃 /trips
  // 就綠 —— fail-open）；2 顆代表 form factor 的 display 切換壞了。
  await expect(trigger, '帳號入口在當前 viewport 應恰好一顆可見').toHaveCount(1);
  await trigger.click();
  // sheet 真的開了才算掃到 sheet。openSheet 只設 flag，導航仍是 <Link to="/account">：
  // flag 沒生效就退化成 /account 全頁 fallback，而 /account 本來就在上面的 PAGES 清單裡、
  // 已知乾淨 → 掃到全頁也會綠（第二個 fail-open）。用 sheet overlay 的 role=dialog 鎖住。
  const sheet = page.getByRole('dialog', { name: '帳號' });
  await expect(
    sheet,
    '點帳號入口後應開出帳號 sheet（overlay），不是退化成 /account 全頁',
  ).toBeVisible();
  // 再等內容真的 render。AccountPage 是 lazy（main.tsx `lazyWithRetry`）且 sheet 內包
  // `<Suspense fallback={null}>` —— overlay 外殼可見時 body 可能還是空的，這時掃 axe 等於
  // 掃一個空 sheet（第三個 fail-open）。原本靠 `waitForTimeout(300)` 恰好蓋住這段，改成
  // 斷言式等待就必須明寫，不能只驗外殼。兩道斷言各管一種失效模式，是疊加不是取代。
  await expect(
    sheet.getByTestId('account-page'),
    'sheet 外殼開了但內容還沒 render（lazy chunk / Suspense 未解）—— 這時掃到的是空 sheet',
  ).toBeVisible();
  const bad = await scanSeriousCritical(page);
  if (bad.length) {
    // eslint-disable-next-line no-console
    console.log('\n[a11y account-sheet] serious/critical:\n' + JSON.stringify(bad, null, 2));
  }
  expect(bad, '帳號 sheet 有 serious/critical a11y 違規').toEqual([]);
});
