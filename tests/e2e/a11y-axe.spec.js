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
  // #1168：地圖頁整頁納入。之前只能掃 trip switcher 下拉子樹，因為整頁還有 9 個對比違規
  // （eyebrow 的 opacity 稀釋 + entry card 的 day palette 當文字），兩者都已在 #1168 修好。
  // 不能用 /map —— GlobalMapPage 在帳號有 trips 時會無條件轉址到 /trip/:id/map。
  { name: 'map', path: '/trip/okinawa-trip-2026-Ray/map?day=all' },
];

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  // 地圖頁用得到（#1168 把它加進 PAGES 後，上面的通用迴圈也需要這兩條）：
  // 本機 .env.local 有 Google Maps key，不擋就會打真 API 而 localhost 非授權 referer；
  // CI 無 key，useGoogleMap 直接 setLoadError 不注入 script。擋掉即與 CI 同條件。
  // 對其他頁無副作用（它們不打這兩個 endpoint）。
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
  await page.route('**/api/route**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ polyline: [], duration: null, distance: 0, approx: true }),
  }));
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

test('a11y: 信箱驗證等候頁無 serious/critical axe 違規', async ({ page }) => {
  // 公開路由，不需要登入 mock；本頁掛載時不發任何 request，networkidle 立即成立，
  // 所以額外等 testid 才能確定 lazy chunk 真的到位。
  await page.goto('/signup/check-email?email=test%40example.com');
  await page.waitForLoadState('networkidle');
  await page.getByTestId('verify-pending-page').waitFor({ state: 'visible' });
  // #1157 已修好本頁兩處，指紋斷言依它自己留的指示收掉，改成零違規：
  //   .tp-verify-banner 說明文字   --color-accent 疊 tonal 底 3.24 → -text-on-tonal 5.76
  //   「改用其他信箱」連結          --color-accent 疊 頁面底  3.65 → -text          5.35
  await expectNoSeriousCritical(page, '信箱驗證等候頁');
});

test('a11y: titlebar action hover 態（共用 chrome）無 serious/critical 違規', async ({ page }) => {
  // #1169：.tp-titlebar-action:hover 的文字色是**共用 chrome** —— 這個 class 出現在每個有
  // 動作按鈕的 TitleBar 上。原本 --color-accent 疊 --color-hover：light 3.27:1 / dark 3.82:1，
  // label 是 16px/600 屬一般文字、門檻 4.5，兩個色系都不達標。
  //
  // 為什麼上面 /trips、/favorites、/account 三支全綠卻沒抓到：**沒有任何一支去 hover 它**。
  // 那正是 #1150 要收的「綠著但沒在守」—— 所以守衛得主動 hover，不能只 goto。
  //
  // 只在桌機有意義：.tp-titlebar-action-label 在 ≤760px 是 display:none（tokens.css），
  // 手機 project 上那個文字節點不存在，寫斷言會在手機必敗。
  const vp = page.viewportSize();
  test.skip(!vp || vp.width <= 760, 'label 在 ≤760px 隱藏，hover 文字對比只在桌機成立');

  // 用 /settings/sessions 的「登出其他裝置」action 當樣本：它是 .tp-titlebar-action 且帶
  // 可見 label。要 render 出來需要 mock 裡有「非目前」的工作階段 —— api-mocks 的
  // MOCK_SESSIONS 已有 sid 'iphone'，不必新增 mock。
  await page.goto('/settings/sessions');
  await page.waitForLoadState('networkidle');
  const action = page.getByTestId('sessions-revoke-all');
  await action.waitFor({ state: 'visible' });
  // 真滑鼠移入才會觸發 :hover 偽類，加 class 模擬不算。
  await action.hover();
  // .tp-titlebar-action 有 `transition: background-color 150ms, color 150ms`。過渡期間
  // getComputedStyle 回的是插值，對比會落在起訖值之間 —— 太早取樣，回歸（改回
  // --color-accent）會量到假綠。等超過 150ms 再掃，同 #1156 在 hover 卡那支學到的。
  await page.waitForTimeout(200);
  // 掃描範圍縮到 titlebar 子樹：本頁其餘部分還有一個「目前」pill 的語意色違規（2.35:1，
  // 追蹤於 #1176），整頁掃會為了別的原因紅、把這支守衛的訊號蓋掉。同一頁的那個違規已由
  // 下面「登入工作階段頁」那支的指紋斷言負責鎖住，不會因為這裡縮範圍而失去守備。
  await expectNoSeriousCritical(page, 'titlebar action hover 態', '.tp-titlebar');
});

test('a11y: titlebar 帶文字返回鈕 hover 態無 serious/critical 違規', async ({ page }) => {
  // #1169 的票說「不要順手改 .tp-titlebar-back:hover，它沒有可見文字、非文字門檻 3:1 已達標」
  // —— 那個前提只對 icon-only 變體成立。.tp-titlebar-back--labeled 會顯示可見的
  // 「‹ <label>」文字（TitleBar.tsx 依 backLabelVisible 掛上，用於 /privacy 與 /explore），
  // callout(16px) + 600 屬一般文字、門檻 4.5。它非 hover 時是 --color-accent-deep（4.78:1
  // 達標），一 hover 就被 .tp-titlebar-back:hover 的色蓋掉 → 原本 light 3.27 / dark 3.82。
  //
  // 所以那條規則也改了，這支就是它的守衛 —— 不然這是一個沒有任何測試覆蓋的修正。
  const vp = page.viewportSize();
  test.skip(!vp || vp.width <= 760, 'label 在 ≤760px 隱藏，hover 文字對比只在桌機成立');

  // /privacy 是靜態頁（不需要登入或 API mock），是最便宜的 labeled 返回鈕樣本。
  await page.goto('/privacy');
  await page.waitForLoadState('networkidle');
  await page.getByTestId('privacy-page').waitFor({ state: 'visible' });
  const back = page.locator('.tp-titlebar-back--labeled');
  await expect(back, 'labeled 返回鈕不存在 —— 這支守的東西沒 render，別讓它靜默通過').toHaveCount(1);
  await back.hover();
  // 同 action 那支：transition 150ms，等超過再掃，否則量到插值假綠。
  await page.waitForTimeout(200);
  await expectNoSeriousCritical(page, 'titlebar labeled 返回鈕 hover 態', '.tp-titlebar');
});

test('a11y: 登入工作階段頁 — 語意色 pill 與說明文字都無對比違規', async ({ page }) => {
  // /settings/sessions 與 /account/sessions 都指向 SessionsPage，深連結時兩者都落在
  // 主 routes（sheet 那份要 background location 才會 render）。選 /settings/sessions
  // 純粹是對齊既有的 tests/e2e/settings-pages.spec.js。
  await page.goto('/settings/sessions');
  await page.waitForLoadState('networkidle');
  await page.getByTestId('sessions-row-current').waitFor({ state: 'visible' });
  // 本頁原本兩個違規，兩個都修掉了：
  //   ✅ .tp-banner-info 說明文字（#1157）—— --color-accent 疊 tonal 底 3.24 → -text-on-tonal 5.76
  //   ✅ .tp-pill-current「目前」（#1176）—— 原本 --color-success 疊 12% alpha 的
  //      --color-success-bg，再疊父層 .tp-row-current 的 --color-accent-subtle，合成成
  //      #D7E5D7 只有 2.35。修法是把 -bg 改成不透明（半透明底才會有「合成色隨父層漂移」
  //      這回事）+ 文字改走 --color-success-deep → 4.60。
  //
  // 這裡先前是正面指紋斷言（`'color-contrast | .tp-pill | 2.35'`），刻意設計成「#1176 修好時
  // 會因指紋不符轉紅」的提醒機制。提醒已兌現，改回 expectNoSeriousCritical。
  // token 層的對比由 tests/unit/semantic-color-contrast.test.ts 逐對鎖住（含深色與
  // prefers-contrast 加強階，那兩者 axe 都掃不到）。
  await expectNoSeriousCritical(page, '登入工作階段頁');
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

test('a11y: 帳號 sheet 的焦點真的關在裡面（aria-modal 不是空頭承諾）', async ({ page }) => {
  // #1150 story 6。`aria-modal="true"` 是對輔助技術的承諾：這層外面的內容是 inert 的。
  // 瀏覽器不會替你實現 —— 沒有 Tab 攔截，鍵盤使用者一路 Tab 就會走到被遮住的頁面上，
  // 而螢幕閱讀器已經照 aria-modal 把那些藏起來了。宣告了卻沒做，比不宣告更糟。
  //
  // AccountSheet 原本只有一個 window keydown 監聽 Escape，沒有 trap（v2.57.70 修）。
  // 這條放 e2e 而不是 unit：jsdom 不做真正的 sequential focus navigation，按 Tab 焦點
  // 根本不會動 —— 在那裡寫這條測試會恆綠。
  await page.goto('/trips');
  await page.waitForLoadState('networkidle');
  const trigger = page
    .getByTestId('titlebar-account')
    .or(page.getByTestId('sidebar-account-card'))
    .filter({ visible: true });
  await expect(trigger, '帳號入口在當前 viewport 應恰好一顆可見').toHaveCount(1);
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: '帳號' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('account-page')).toBeVisible();

  // Tab 走足夠多次以繞完整個 sheet 一圈以上；每一步焦點都必須還在 sheet 裡。
  // 次數取得比 sheet 內可聚焦元素多，才會真的撞到「最後一個 → 回到第一個」那個環。
  const insideCount = await sheet.locator(
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
  ).count();
  expect(insideCount, 'sheet 裡應該有可聚焦元素，否則下面的迴圈驗不到東西').toBeGreaterThan(1);

  for (let i = 0; i < insideCount + 3; i++) {
    await page.keyboard.press('Tab');
    const stillInside = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      return dialog ? dialog.contains(document.activeElement) : false;
    });
    expect(stillInside, `第 ${i + 1} 次 Tab 後焦點跑出 sheet 外了`).toBe(true);
  }
});
