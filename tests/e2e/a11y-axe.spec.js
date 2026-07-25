// @ts-check
/**
 * W15 · Accessibility 守衛 — axe-core 自動掃描 key 頁面。
 *
 * HIG a11y 收網（依賴 W1 4-tab/帳號 sheet、W4 色彩對比、W11 表單）。用 axe-core 對主要
 * 頁面跑無障礙稽核，鎖住 serious/critical 違規不得出現（防未來 regress）。
 *
 * 掃描範圍：mockable 的 key 頁（行程一覽 / 收藏 / 帳號 + 帳號 sheet），#1155 再加上
 * 信箱驗證等候頁、登入工作階段頁，以及地圖頁 trip switcher 下拉（僅掃下拉子樹）。
 * 聊天（後端串流）在 e2e 環境不穩，仍未納入。
 *
 * ⚠ 地圖頁「整頁」仍未納入，而且不是因為 Google Maps 不穩（擋掉 maps.googleapis.com
 *   即與 CI 同條件、頁面正常 render）—— 是因為 /trip/:id/map 整頁目前有 9 個既有
 *   serious 對比違規（.tp-map-day-tab-eyebrow 3.25:1、.tp-map-entry-card-day 的
 *   day palette 2.08–4.10:1），整頁納入會立刻紅。那些不屬 #1155/#1157，要另開票。
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
 *   is actual text content"），而本檔只讀 results.violations。
 *   實例：行程一覽頁的分類 tab 計數徽章修前是 --color-accent 疊 --color-accent-subtle
 *   （3.24:1，真違規），但行程數 ≤9 時它是單字元，axe 一律掃不到，滿 10 筆變兩位數才
 *   掃得出來 —— 那個綠會隨 mock 資料量飄。#1156 已把它改成 --color-accent-text-on-tonal
 *   （5.76:1），但**盲區本身還在**：任何單字元元素的對比都得靠
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

/**
 * 跑 axe，回 serious/critical 違規（精簡欄位）。
 *
 * rootSelector 可把掃描範圍縮到單一子樹。只在「整頁另有與本場景無關的既有違規、
 * 但仍想鎖住這個元件」時才用 —— 見 #1155 的地圖 trip switcher 場景。
 * 預設不帶，掃整份 document。
 *
 * ⚠ include/exclude 一定要放在 axe.run 的**第一個參數（context）**。#1155 之前這裡把
 *   exclude 塞在第二個參數（options）裡 —— axe 的 RunOptions 根本沒有這個欄位
 *   （見 node_modules/axe-core/axe.d.ts：exclude 屬 ContextObject），所以那份
 *   「排除第三方 widget」從來沒有生效過，只是看起來有。
 */
async function scanSeriousCritical(page, rootSelector) {
  await page.addScriptTag({ path: axePath });
  const results = await page.evaluate(async (sel) => {
    // 第三方 widget 容器（地圖 canvas 等）—— 非我方 markup，不列入。
    const EXCLUDE = [['.gm-style'], ['iframe']];
    if (sel) {
      // eslint-disable-next-line no-undef
      if (!document.querySelector(sel)) throw new Error(`axe 掃描根節點不存在：${sel}`);
    }
    const context = sel
      ? { include: [[sel]], exclude: EXCLUDE }
      : { exclude: EXCLUDE };
    // eslint-disable-next-line no-undef
    return await window.axe.run(context, { resultTypes: ['violations'] });
  }, rootSelector);
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

/** 掃描 + 印明細 + 斷言零違規。全檔共用，避免每支測試各抄一份。 */
async function expectNoSeriousCritical(page, label, rootSelector) {
  const bad = await scanSeriousCritical(page, rootSelector);
  if (bad.length) {
    // eslint-disable-next-line no-console
    console.log(`\n[a11y ${label}] serious/critical:\n` + JSON.stringify(bad, null, 2));
  }
  expect(bad, `${label} 有 serious/critical a11y 違規`).toEqual([]);
}

/**
 * 把違規壓成可比對的字串清單，用來**正面斷言「目前確實紅在這幾處」**。
 *
 * 為什麼不用 Playwright 的 test.fail()「預期失敗」標記（#1154 當時的做法）：
 * test.fail() 會把整支測試的失敗都當成「如預期」，包含 route 改名、testid 消失、
 * mock 漂移造成的 timeout —— 守衛壞掉與守衛正在守就分不出來，一律綠燈。
 * 那正是 #1150 這批工作要消滅的東西，不該在收網的過程裡再種一次。
 *
 * 正面斷言則三種情況都會叫：
 *   頁面/選擇器壞掉 → 掃不到違規 → 紅
 *   有人把顏色修好了（#1157）→ 掃不到違規 → 紅，提醒回來收尾
 *   冒出新的違規 → 清單多一項 → 紅
 */
function violationFingerprints(bad) {
  return bad
    .flatMap((v) => v.detail.map((d) => `${v.id} | ${d.target} | ${d.data ? d.data.contrastRatio : '?'}`))
    .sort();
}

for (const p of PAGES) {
  test(`a11y: ${p.name} 無 serious/critical axe 違規`, async ({ page }) => {
    await page.goto(p.path);
    await page.waitForLoadState('networkidle');
    await expectNoSeriousCritical(page, p.name);
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
  // 這張卡有 transition: color 120ms。getComputedStyle 在過渡期間回的是插值，
  // 對比會落在起訖值之間 —— 太早取樣，回歸（改回 --color-accent）會量到假綠。
  // 等超過 transition 時間再掃，別靠 addScriptTag 的耗時碰運氣。
  // （#1156 把原本的 50ms 改成 200ms；#1155 把掃描收斂成 expectNoSeriousCritical helper。
  //   rebase 時兩者都要留 —— 200ms 是承重的，helper 只是寫法。）
  await page.waitForTimeout(200);
  await expectNoSeriousCritical(page, 'trips 新增行程卡 hover 態');
});

test('a11y: 「已封存」分類篩選結果為零時的重設按鈕無 serious/critical 違規', async ({ page }) => {
  await page.goto('/trips');
  await page.waitForLoadState('networkidle');
  // mock 帳號的兩筆行程都沒有 archivedAt，切到「已封存」分類必為空清單 → 觸發 reset 按鈕渲染。
  await page.getByTestId('trips-list-tab-archived').click();
  await page.getByTestId('trips-list-archived-reset').waitFor({ state: 'visible' });
  await expectNoSeriousCritical(page, 'trips 已封存空清單 reset 按鈕');
});

// ── #1155：擴大掃描範圍 ──────────────────────────────────────────────────────
// #1154 處理的是「頁面在清單裡、但違規狀態掃不到」。這一輪處理另一類漏接：頁面／
// 狀態根本不在掃描範圍內。三個目標依票的裁決順序納入，違規本身由 #1157 修。
//
// ⚠ 三個目標裡只有兩個是紅的。地圖 trip switcher 那一項的前提已經過期 —— 見該場景。
//
// 前兩支用 violationFingerprints 正面斷言「目前紅在這幾處」，而不是 #1154 用的
// test.fail()「預期失敗」標記 —— 理由見 violationFingerprints 的說明。

test('a11y: 信箱驗證等候頁 — 鎖住目前已知的柔褐對比違規（待 #1157 修）', async ({ page }) => {
  // 公開路由，不需要登入 mock；本頁掛載時不發任何 request，networkidle 立即成立，
  // 所以額外等 testid 才能確定 lazy chunk 真的到位。
  await page.goto('/signup/check-email?email=test%40example.com');
  await page.waitForLoadState('networkidle');
  await page.getByTestId('verify-pending-page').waitFor({ state: 'visible' });
  const bad = await scanSeriousCritical(page);
  // .tp-verify-banner 說明文字 = --color-accent 疊 --color-accent-subtle；
  // 「改用其他信箱」連結 = --color-accent 疊 --color-background。兩者門檻皆 4.5。
  expect(violationFingerprints(bad), '信箱驗證等候頁的已知違規清單變了 —— 若是 #1157 修好了，'
    + '把這裡改成 expectNoSeriousCritical；若是冒出新違規，先查新的那個').toEqual([
    'color-contrast | .tp-verify-banner > div | 3.24',
    'color-contrast | a[href$="signup"] | 3.65',
  ]);
});

test('a11y: 登入工作階段頁 — 鎖住目前已知的對比違規（待 #1157 修）', async ({ page }) => {
  // /settings/sessions 與 /account/sessions 都指向 SessionsPage，深連結時兩者都落在
  // 主 routes（sheet 那份要 background location 才會 render）。選 /settings/sessions
  // 純粹是對齊既有的 tests/e2e/settings-pages.spec.js。
  await page.goto('/settings/sessions');
  await page.waitForLoadState('networkidle');
  await page.getByTestId('sessions-row-current').waitFor({ state: 'visible' });
  const bad = await scanSeriousCritical(page);
  // .tp-banner-info 說明文字 = --color-accent 疊 --color-accent-subtle（柔褐誤用，本批主題）。
  // .tp-pill-current「目前」= --color-success 疊 --color-success-bg 合成後的 #D7E5D7 ——
  // 這個不是柔褐誤用而是語意色誤用，順帶掃出來的，同樣未達 4.5。
  expect(violationFingerprints(bad), '登入工作階段頁的已知違規清單變了 —— 若是 #1157 修好了，'
    + '把這裡改成 expectNoSeriousCritical；若是冒出新違規，先查新的那個').toEqual([
    'color-contrast | .tp-banner > div | 3.24',
    'color-contrast | .tp-pill | 2.35',
  ]);
});

// 這一支「沒有」test.fail：#1155 預期它會紅，但實際上它是綠的。
//
// 票（與下游 #1157）的前提是「選中列同時有背景與文字兩個柔褐 token，只需要換文字那個」。
// 那個文字 token 早就換掉了 —— css/tokens.css 的
//   .tp-titlebar-trip-row.is-active { background: --color-accent-subtle; color: --color-accent-text; }
// 是 PR #1078（fix(a11y): 淺色 HIG 稽核 A 組）改的，早於本批工作。#8A6038 疊 #F4EDE3
// = 4.74:1，門檻 4.5，通過。checkmark 同樣已是 -text 且 aria-hidden。
// 所以這支的價值不是「證明現在是紅的」，而是把已經修好的狀態鎖住不再退回去。
//
// 掃描範圍必須縮到下拉本身：這條 route 整頁另有 9 個與 switcher 無關的既有 serious
// 違規（.tp-map-day-tab-eyebrow 3.25:1、.tp-map-entry-card-day 的 day palette 2.08–4.10:1），
// 整頁掃會為了別的原因紅。那些另計，不屬本票。
test('a11y: 地圖頁 trip switcher 下拉無 serious/critical 違規（鎖住 #1078 的修正）', async ({ page }) => {
  // 本機 .env.local 有 Google Maps key，不擋就會打真 API 而 localhost 非授權 referer；
  // CI 無 key，useGoogleMap 直接 setLoadError 不注入 script。擋掉即與 CI 同條件。
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
  await page.route('**/api/route**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ polyline: [], duration: null, distance: 0, approx: true }),
  }));
  // 不能用 /map：GlobalMapPage 會無條件轉址到 /trip/:id/map（有 trips 時）。
  await page.goto('/trip/okinawa-trip-2026-Ray/map?day=all');
  await page.waitForLoadState('networkidle');
  // switcher 只在 trips.length > 1 時可展開；mock 給了兩筆。
  await page.getByTestId('map-trip-title').click();
  await page.locator('.tp-titlebar-trip-row.is-active').waitFor({ state: 'visible' });
  await expectNoSeriousCritical(page, '地圖頁 trip switcher 下拉', '.tp-titlebar-trip-dropdown');

  // Negative control —— 這是本檔唯一「一開始就是綠」的守衛，沒有這段就沒有任何證據
  // 證明它抓得到東西（縮範圍的 include 打錯、選擇器失效都會靜默全綠）。
  // 把選中列的文字改回修正前的 --color-accent，同一支掃描必須立刻紅。
  await page.addStyleTag({
    content: '.tp-titlebar-trip-row.is-active { color: var(--color-accent) !important; }',
  });
  const injected = await scanSeriousCritical(page, '.tp-titlebar-trip-dropdown');
  expect(
    injected.some((v) => v.id === 'color-contrast'),
    'negative control 失效：把選中列改回 --color-accent 後掃描仍是綠的，代表這支守衛沒有在守',
  ).toBe(true);
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
  await expectNoSeriousCritical(page, '帳號 sheet');
});
