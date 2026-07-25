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
 *   (a) 「新增行程」trailing 卡只在 `:hover` 偽類才切成 --color-accent 文字 + 淡底，
 *       CSS 選擇器不觸發就不會被 axe 抓到對比（需真滑鼠 hover，不能用 class 模擬）。
 *   (b) 「已封存」分類篩選出的重設按鈕（回到全部）只在該分類結果為零筆時才 render，
 *       預設頁面（全部分類）走不到那個條件分支，DOM 裡根本沒有這個節點。
 * 下面兩支場景各自主動觸發該狀態再掃描，用 test.fail() 標記「預期失敗」以便追蹤
 * （見場景前的說明），不是把頁面加進掃描清單 —— 頁面本來就在清單裡。
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
// 下面兩支場景刻意「主動觸發」該狀態再掃，證明守衛能力所及、也留紀錄哪裡還紅：
// - test.fail() 是 Playwright 的「預期失敗」標記：測試本體照常斷言零違規，
//   若真的抓到 serious/critical（目前確實會），CI 會顯示為「預期失敗」而不是
//   紅燈擋 pipeline；一旦下游票（#1155／#1156）修好對比、變成真的零違規，
//   test.fail() 反而會因為「預期失敗卻通過」被判失敗 —— 屆時把這行拿掉即可，
//   不會有人忘記收尾。

test('a11y: 「新增行程」卡 hover 態（真滑鼠移入）已知有 serious/critical 違規 — 追蹤於 #1155', async ({ page }) => {
  test.fail(true, '.tp-trip-card-new:hover 文字色（--color-accent）在 --color-accent-subtle 底色對比不足；根因是 hover 偽類本身沒被掃到，非頁面漏掃（#1155 修色後移除本行）。');
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

test('a11y: 「已封存」分類篩選結果為零時的重設按鈕已知有 serious/critical 違規 — 追蹤於 #1156', async ({ page }) => {
  test.fail(true, '.tp-trips-loading 內 reset 按鈕文字色（--color-accent）在 --color-background 底色對比不足；根因是這個節點只在「已封存 tab + 空清單」條件渲染下才存在，預設頁面狀態量不到（#1156 修色後移除本行）。');
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
  // 桌機側欄帳號 chip 或 手機 header 圓圈 → 開帳號 sheet。用 testid 容錯。
  const trigger = page.getByTestId('account-circle').or(page.getByTestId('sidebar-account-card')).first();
  if (await trigger.count()) {
    await trigger.click();
    await page.waitForTimeout(300);
  }
  const bad = await scanSeriousCritical(page);
  if (bad.length) {
    // eslint-disable-next-line no-console
    console.log('\n[a11y account-sheet] serious/critical:\n' + JSON.stringify(bad, null, 2));
  }
  expect(bad, '帳號 sheet 有 serious/critical a11y 違規').toEqual([]);
});
