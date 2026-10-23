# Major 升版評估（可直接開票版）

日期：2026-10-23　基準：branch `chore/deps-minor-upgrade`（commit `1f99dc27`）
前一份：[dependency-vulnerabilities-2026-10-23.md](dependency-vulnerabilities-2026-10-23.md) §3.2（本文取代其中 major 段；該段標「未證實」的項目已逐一補讀原文，結論差異見 §0.2）

> 本文唯讀產出：**沒有修改** repo 的 `package.json` / lockfile / 程式碼。所有「實測」都在 repo 的**拋棄式複本**（scratchpad，無 `.git`）裡跑，方法與限制見 §10。

---

## 0. 結論先講

### 0.1 一句話判斷

| 套件 | 現況 -> 最新穩定 | 風險 | 建議 |
|---|---|---|---|
| `concurrently` | 9.2.5 -> 10.0.6 | 低 | 現在升（Batch 1） |
| `dotenv` | 16.6.1 -> 18.0.9 | 低 | 現在升（Batch 1）；本專案只用 `dotenv.parse()` |
| `@testing-library/jest-dom` | 6.9.1 -> 7.0.1 | 低 | 現在升（Batch 1） |
| `vitest`（+ 移除 `@vitest/runner`、`@vitest/snapshot`） | 4.1.12 -> 5.0.5 | 中（比先前判斷低） | 現在升，但**先釘 Node 版本**（Batch 2） |
| `jsdom` | 26.1.0 -> **30.1.3**（不是 29） | 中 | 與 vitest 5 同批（Batch 2） |
| `marked` | 17.0.6 -> 18.1.1 | 低 | 現在升，獨立 PR（Batch 3） |
| `vite-plugin-pwa` | 1.3.0 -> 2.0.0 | 低 | 現在升，獨立小 PR（Batch 4） |
| `@sentry/react` + `@sentry/vite-plugin` | 10.76.2 / 5.4.1 -> 11.9.0 | **高（觀測面，不是程式面）** | 延後，先決定告警基準與 `traceLifecycle`（Batch 5） |
| `typescript` | 5.9.3 -> 7.0.2 | 7.0：**高（阻塞）**；6.0.3：中 | **不升 7**；可先升 6.0.x（Batch 6），7 等 typescript-eslint 支援 |

### 0.2 與前一份報告的差異（已實測更正）

1. **jsdom 最新是 30.1.3，不是 29.1.1**（`npm view jsdom dist-tags` -> `latest: 30.1.3`；[jsdom Releases](https://github.com/jsdom/jsdom/releases)）。29 與 30 之間 30.0.0 再次抬高 Node 下限（見 §5）。
2. **vitest 5 的風險比先前判斷低**：在複本上 `vitest@5.0.5` 單獨升（移除 `@vitest/runner`、保留/移除 `@vitest/snapshot` 皆試過）後，`unit-dom` 203 檔 / 1838 tests 全綠、`unit-node` 結果與基準逐條相同、`test:api` 1302 全綠（見 §6）。先前列的「高風險」多數 breaking 在本專案**沒有命中點**（grep 證據見 §6.2）。
3. **TypeScript 7 的阻塞點不只是 typescript-eslint peer**：TS 7.0.2 的 npm 套件**沒有 JS API**（`require('typescript')` 只有 2 個 key、沒有 `createSourceFile`），typescript-eslint 直接以訊息拒絕啟動（實測，§8）。另外 `baseUrl` 在 7 是硬錯誤、`types` 預設變 `[]`。
4. dotenv 17/18 的 breaking 原文已讀（§4）；jsdom 27/28/29/30 已讀；TypeScript 6.0/7.0 官方 blog 已讀。**仍標「未證實」的項目**集中列在 §9。

### 0.3 最大風險（依重要性）

1. **Sentry 11 讓現有 `beforeSendTransaction` 靜默失效**（實測：預設 `traceLifecycle: 'stream'` 下 callback 被呼叫 0 次，SDK 印警告；設 `'static'` 才會呼叫）。`src/lib/sentry.ts:119` 用它擋 HeadlessChrome / localhost 的 pageload，升版後這些雜訊會直接進 Sentry。另外 crash-free session、Web Vitals、transaction 命名都會變（`docs/monitoring/sentry-alerts.md` Alert 1/2/4 的基準受影響）。
2. **Node 版本下限**：vitest 5 要 `^22.12 || ^24 || >=26`、jsdom 30 要 `^22.22.2 || ^24.15 || >=26`。**Node 25 兩者都不在範圍內**；本機 session 起始時 `node -v` 是 v25.9.0（後來同一台變成 v26.12.1）。repo 沒有 `.nvmrc` / `engines`。
3. **TS 7 不可升**（typescript-eslint 與 CI lint gate 會壞）。
4. **`.npmrc` 設了 `legacy-peer-deps=true`**（`/Users/ray/Projects/trip-planner/.npmrc:1`）：peer 衝突**不會**在 `npm install` 報錯，必須靠本文 §7 的矩陣與實跑驗證，不能指望 npm 擋。

---

## 1. 驗證基準與方法

- 基準（升版前）在 Node v22.23.4 實測：`unit-dom` 203 files / 1838 tests 綠；`unit-node` 318 files，3 個失敗皆為 `tests/unit/repository-retirement.test.ts`（複本沒有 `.git` 造成 `git grep` 失敗，與升版無關，升版前後相同）；`test:api` 116 files / 1302 tests（見 §6.3 的 flaky 說明）。
- 所有升版組合都在複本中以 `npm i` 實裝後再跑。複本與正式 repo 無連動。
- 一手來源清單見 §11。

---

## 2. 逐套件評估

### 2.1 `concurrently` 9.2.5 -> 10.0.6

**Breaking（原文）**：[v10.0.0 release](https://github.com/open-cli-tools/concurrently/releases/tag/v10.0.0)
- 不支援 Node `<22.0.0`；ESM-only；prefix 顏色預設改為自動；移除 CLI `--name-separator` 與 API `killOthers`。
- 10.0.1–10.0.6 只有 export type、publish 流程、`shell-quote` 升到 1.12.0（[v10.0.6](https://github.com/open-cli-tools/concurrently/releases/tag/v10.0.6)，[v10.0.4](https://github.com/open-cli-tools/concurrently/releases/tag/v10.0.4)）等修正，無新 breaking。

**本專案命中**：
- 只當 CLI 用：`package.json:6`（`dev`）、`:9`（`dev:staging`）、`:10`（`dev:prod`），只用 `-n` / `-c`，**不命中**任何被移除的選項。repo 內沒有 `require('concurrently')` / `import ... 'concurrently'`（`grep` 全 repo 無）。
- 「ESM-only」不影響 CLI。

**實測**：複本上 `npx concurrently -n vite,api -c cyan,green "echo vite-ok" "echo api-ok"` 在 concurrently 10.0.6 + Node 22.23.4 正常輸出、exit 0。**未實跑**真的 `vite` + `wrangler pages dev`（需要 dev server 與 D1）。

**風險**：低。改動 = `package.json` 一行 + lockfile。
**驗證**：`npm run dev` 手動起來確認兩個 prefix 都出、Ctrl-C 兩邊都收；CI 不跑 dev 腳本，所以沒有自動守門。
**建議**：現在升（Batch 1）。補充：9.2.5 已含 `shell-quote@1.12.0`（[v9.2.5](https://github.com/open-cli-tools/concurrently/releases/tag/v9.2.5)），升 10 並非為了漏洞，純粹少一個舊 major。

### 2.2 `dotenv` 16.6.1 -> 18.0.9

**Breaking（原文）**：[CHANGELOG.md](https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md)
- 17.0.0：`config()` 的 `quiet` 預設改 false，預設會印「injecting env」log（[17.0.0 條目](https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md)）。
- 18.0.0：新增 CLI 與 `fast` parser（opt-in）；**注入訊息改走 stderr**、移除 tips；**移除 `.env.vault` 支援、移除 preloading（`-r dotenv/config`）**。18.0.4 起 `import dotenv/config` 預設 `quiet: true`。
- 18.0.1–18.0.9 為修補（fast parser 邊界、`DOTENV_QUIET`、型別）。

**本專案命中**：
- 唯一 require：`scripts/lib/load-env.js:12`（`const dotenv = require('dotenv')`），只呼叫 `dotenv.parse(content)`（`scripts/lib/load-env.js:26`，且註解 `:20` 明寫「純函數、無副作用、不碰 stdout」）。
- 另一個入口 `scripts/lib/load-env.mjs:33-36` 的註解已預先處理「v17+ 會把 tip 印到 stdout 汙染 eval」問題：它只用 `parse()`，所以 17 的 quiet 預設與 18 的 stderr 改動**都不命中**。
- 沒有使用 `.env.vault`、`-r dotenv/config`、`config()`（`grep dotenv` 在 `src/ functions/ scripts/` 僅此兩處與測試）。

**實測**：以 4 組樣本（多行單引號 JSON、`export`、行內註解、CRLF、重複 key、含 `#` 的 URL）比對 `dotenv@16.6.1` 與 `18.0.9` 的 `parse()` 輸出：**0 差異**。複本上 `load-env-script` / `env-local-parse` 等測試在 `unit-node` 全綠。

**風險**：低（價值也低）。
**驗證**：`npx vitest run tests/unit/load-env-script.test.ts tests/unit/env-local-parse.test.ts tests/unit/round8a-scripts-security.test.ts`；再手動 `eval "$(node scripts/lib/load-env.mjs .env.local)"` 比對 export 行。
**建議**：現在升（Batch 1），純維護性。**未證實**：fast parser 與預設 parser 的差異（本專案不啟用，沒有影響）。

### 2.3 `@testing-library/jest-dom` 6.9.1 -> 7.0.1

**Breaking（原文）**：[v7.0.0](https://github.com/testing-library/jest-dom/releases/tag/v7.0.0)：`@testing-library/dom` 變必要 peer、Node 最低 22。[v7.0.1](https://github.com/testing-library/jest-dom/releases/tag/v7.0.1)：把 `vitest` 宣告成 optional peer。新增 `toContainAnyBy*` / `toContainOneBy*` matcher（6.10.0 也有）。

**peer（npm registry）**：`vitest >=0.32`（optional）、`@testing-library/dom >=10 <11`。本專案 `@testing-library/dom@10.4.2`（`npm ls`）滿足。
**本專案命中**：`tests/setup-dom.js:5` 以 `import '@testing-library/jest-dom'`（root entry，非 `/vitest`）；v7 的 `exports["."]` 仍存在（`npm view @testing-library/jest-dom@7.0.1 exports`）。`toHaveTextContent` 在 `tests/` 有 101 處（`grep -rn toHaveTextContent tests`），皆為 jest-dom 的 matcher。

**實測**：與 vitest 5 / jsdom 30 同裝時 `unit-dom` 全綠（§6）。
**風險**：低。**建議**：現在升（Batch 1）；Node 下限 22 與 CI（`.github/workflows/ci.yml:22` 為 `'22'`）一致。

### 2.4 `vitest` 4.1.12 -> 5.0.5（含 `@vitest/runner`、`@vitest/snapshot`）

見 §6 專節（內容較多）。**結論：中風險，現在可升，前提是先釘 Node。**

### 2.5 `jsdom` 26.1.0 -> 30.1.3

見 §5 專節。

### 2.6 `marked` 17.0.6 -> 18.1.1

**Breaking（原文）**：[v18.0.0](https://github.com/markedjs/marked/releases/tag/v18.0.0)：「trim trailing blank lines from block tokens」「update TypeScript to v6」；bug fix：GFM table / heading / def token 不再貪婪吃尾端換行。18.0.1–18.1.1 為大量 CommonMark 邊界修正（hard line break 後去前導空白、HTML block、autolink、巢狀 blockquote 等，見 [v18.0.13](https://github.com/markedjs/marked/releases/tag/v18.0.13)、[v18.0.14](https://github.com/markedjs/marked/releases/tag/v18.0.14)、[v18.1.1](https://github.com/markedjs/marked/releases/tag/v18.1.1)）。`engines.node >=20`（npm registry）。

**本專案命中**（唯一使用點）：`src/lib/sanitize.ts:79` `import { marked } from 'marked'`；`:95` `marked.parse(...)`（`renderMarkdown`）；`:105` `marked.parseInline(...)`（`renderMarkdownInline`）。輸出一律再經 `sanitizeHtml`（`:95`、`:105`）。呼叫者：`src/components/shared/MarkdownText.tsx`。相關測試：`tests/unit/markdown-text-xss.test.tsx`、`sanitize-uri-attrs.test.ts`、`sanitize-href-relative.test.ts`、`round7a-security.test.tsx`、`v2_31_91-chat-md-link-style.test.ts`。另有 `vite.config.ts:127` 的 `manualChunks`（`node_modules/marked/`）。專案自訂的 `~` escape（`src/lib/sanitize.ts:84-92`）不依賴 marked 內部。

**實測**（差異比對）：以 repo 內 581 份 `.md`（含 `.claude/skills` 等長文件，非 AI 回覆但格式多樣）+ 8 個手寫樣本，套用同一個 `normalizeForMarkdown`，分別用 17.0.6 與 18.1.1 的 `parse` / `parseInline`：
- 字串級差異 67 筆；**忽略標籤間空白後剩 17 筆**（`parse` 2 筆、`parseInline` 15 筆）。
- `parse` 的 2 筆：硬換行 `<br>` 後多餘前導空白被去掉（對應 18.0.13「drop the leading whitespace after a hard line break」）。
- `parseInline` 的 15 筆：全部是跨很多行的 code fence 內容被當 inline 解析的病態輸入，`**粗體**` 在 code span 之後由「保留星號」變成 `<strong>`（對應 18.1.1「keep a backslash in a code span from hiding emphasis」）；不是本專案的實際輸入型態（實際是 AI 回覆短文）。
- 8 個手寫樣本（含 `<script>`、`javascript:` 連結、表格、`~` 範圍）**0 差異**。
- bundle：`marked` chunk 40,516 -> 45,494 bytes（gzip 12,168 -> 13,513）；`scripts/bundle-size-check.sh`（300KB）通過。

**風險**：低（輸出經 sanitizer；差異多為空白/邊界）。**驗證**：上述 5 個測試 + `npm run build` + 抽查 AI 聊天畫面一則含清單/表格的回覆（`/browse` 截圖，本文未做瀏覽器驗證）。
**建議**：現在升，**獨立 PR**（輸出會變，不要與測試鏈混在一起以免歸因困難）。

### 2.7 `vite-plugin-pwa` 1.3.0 -> 2.0.0

**Breaking（原文）**：[v2.0.0 release](https://github.com/vite-pwa/vite-plugin-pwa/releases/tag/v2.0.0)：唯一 ⚠️ 項是「allow `@vite-pwa/assets-generator ^2.0.0` as a peer dependency」；[README](https://github.com/vite-pwa/vite-plugin-pwa#-install) 註明 v2 起需要 Node >= 20.19.0。其餘為 CI/docs。npm registry：v2 peer 為 `vite ^3.1…^8`、`workbox-build ^7.4.1`、`workbox-window ^7.4.1`、`@vite-pwa/assets-generator` 為 optional。

**本專案命中**：`vite.config.ts:6`、`:36` 起的 `VitePWA({...})`（`registerType: 'autoUpdate'`、`navigateFallback: null`、自訂 `runtimeCaching`、`manifest: false`）；**沒有**使用 assets-generator（`package.json` 無此依賴）。`src/lib/sentry.ts:30` 的 `SW_REGISTER_FILE_RE = /\/registerSW\.js$/` 依賴 plugin 注入的 `registerSW.js` 檔名。

**實測**：複本 `npx vite build` 成功；`node scripts/verify-sw.js` -> `SW verification PASSED`。**未驗**：`dist/registerSW.js` 檔名是否仍為此名（建議升版 PR 內補一行 `ls dist/registerSW.js`；若改名，Sentry noise filter 會失效且不會報錯）。
**風險**：低。**建議**：現在升，獨立小 PR（Batch 4）；PWA 快取有歷史雷，PR 描述附 `verify-sw` 輸出。

### 2.8 `@sentry/react` + `@sentry/vite-plugin` -> 11.9.0

見 §3 專節。**建議：延後，不是技術阻塞，是觀測基準要先決定。**

### 2.9 `typescript` 5.9.3 -> 7.0.2

見 §8 專節。

---

## 3. Sentry 11 專節（只依官方文件原文）

來源：[MIGRATION.md（10.x -> 11.x）](https://github.com/getsentry/sentry-javascript/blob/develop/MIGRATION.md)、[Release 11.0.0](https://github.com/getsentry/sentry-javascript/releases/tag/11.0.0)。以下「章節」皆指 MIGRATION.md 內的標題。

### 3.1 本專案實際用到的 Sentry 面

- `src/lib/sentry.ts:105-122`：`init({ dsn, integrations: [browserTracingIntegration()], tracesSampleRate: 0.1, beforeSend, beforeSendTransaction })`。
- `captureException`：`src/lib/apiClient.ts:130`（傳 `ApiError`，`src/lib/errors.ts:10` 為 `extends Error`）、`src/components/shared/ErrorBoundary.tsx:31`、`src/lib/sentry.ts:141,154`（傳 `Error`）。
- **沒有**：`captureMessage`、`setTag/setUser/setContext`、Replay、`startSpan`、`@sentry/react` 的 router integration（`grep -rn "captureMessage\|setTag\|setUser\|setContext\|startSpan\|replayIntegration" src` 無命中）。
- build：`vite.config.ts:17-26` 僅在有 `SENTRY_AUTH_TOKEN` 時啟用 `sentryVitePlugin({ org, project, authToken, release: { name } })`；`vite.config.ts:121` 把 `node_modules/@sentry` 切成 `sentry` chunk。
- 監控/告警：`scripts/daily-check.js:75-81`、`scripts/daily-report.js:77-83` 以 Sentry **issues API**（`is:unresolved`）抓錯誤；`docs/monitoring/sentry-alerts.md:17`（Alert 1 錯誤量尖峰，基準 5–20 events/hr）、`:24`（Alert 2 新 issue）、`:31`（Alert 3 level）、`:39`（Alert 4 crash-free < 99%）。

### 3.2 逐項 breaking 與命中判斷

| # | 官方原文（章節） | 命中 | 影響 |
|---|---|---|---|
| 1 | **Span streaming 成為預設**；「`beforeSendTransaction` 與 `ignoreTransactions` will no-op」（「Span streaming is now the default」） | **命中** `src/lib/sentry.ts:119` | 見 §3.3。**實測證實** |
| 2 | 預設 `traceLifecycle: 'stream'`；要保留舊行為設 `traceLifecycle: 'static'`，「only exists for backwards compatibility and is planned for removal」（「Opting out of span streaming」） | 可用 | 過渡手段，非長期 |
| 3 | 瀏覽器 session 受未捕捉錯誤影響時記為 `unhandled` 而非 `crashed`，「expect the crash-free rate to shift」（「Browser sessions use `unhandled` instead of `crashed`」） | **命中** Alert 4 | 基準失效 |
| 4 | `browserSessionIntegration` 預設 `lifecycle` 由 `'route'` 改 `'page'`：session 載入時建立一次、導航不更新（「`page` is the default browser session lifecycle mode」） | **命中** Alert 4 | session 計數口徑改變 |
| 5 | Web Vitals 改為每次 soft navigation 各報一組；「expect the values reported for page loads to drop … most noticeably for CLS and INP. Aggregates such as p75s will shift」（「Web vitals are reported per soft navigation」）；可用 `browserTracingIntegration({ webVitals: { softNavigations: false } })` 還原 | **命中**（用 `browserTracingIntegration()`，`src/lib/sentry.ts:107`） | 效能基準斷層 |
| 6 | bfcache 還原會各自回報 LCP/CLS/INP，標 `browser.navigation.type: bfcache`，「pooling them with page loads will pull aggregates down」（「Back/forward-cache restores report their own web vitals」）；`webVitals: { bfcacheNavigations: false }` 關閉 | 命中 | 同上 |
| 7 | 低基數 span 名稱：pageload/navigation 無參數化路由時改為 `Pageload` / `Navigation`（原為原始 URL path）；`http.client` 名稱只留 method + domain（「span names … low cardinality」表，`pageload`、`navigation`、`http.client` 列） | **命中**：本專案未接 router integration，沒有參數化路由 | transaction/span 名稱全部歸成 `Pageload` / `Navigation` / `GET <domain>`，按路由分析的能力消失（原 URL 仍在 `url.full` 等 attribute，文中表格明載「The URL stays on `url.full`」僅針對 `browser.*` 列；其餘列請升版後在 Sentry 實看） |
| 8 | `attachStacktrace` 預設 `true`：`captureMessage` 與「non-`Error` values passed to `captureException`」會帶 synthetic stack；「you may see new issue groups after upgrading」（「`attachStacktrace` defaults to `true`」） | 幾乎不命中：本專案只傳 `Error`（見 §3.1） | 低；但 Alert 2（新 issue）若有舊 non-Error 事件仍可能多發一次 |
| 9 | `DOMException.code` 不再當 tag，改查 `error.type`（「`DOMException.code` is no longer set as a tag」） | 本 repo 無依 tag 的規則（`docs/monitoring/sentry-alerts.md` 未提）；Sentry UI 內是否有人設規則：**未證實** | 低 |
| 10 | 不再支援 Safari 14，最低 Safari 15（「Version Support Changes」） | 邊緣：`vite.config.ts` 的 workbox `babelPresetEnvTargets` 仍含 `safari >= 14` | 低；產品實際瀏覽器分布未查 |
| 11 | `@sentry/vite-plugin` 內部由 `@sentry/cli` 改為 `sentry` CLI SDK（Release「@sentry/bundler-plugins」：`feat(bundler-plugins)!: Migrate from @sentry/cli to the sentry CLI SDK`）；`@sentry/vite-plugin@5.4.1` 現本就依賴 `@sentry/bundler-plugins@^10.76.0`，`11.9.0` 依賴 `11.9.0`（npm registry） | 命中（`vite.config.ts:19`）；本專案只用 `org/project/authToken/release.name`，不在被移除清單（`release.uploadLegacySourcemaps`、`_experiments`、整體 `disable`，見 MIGRATION「Removed `unstable_` bundler plugin options」） | 低；實測見 §3.4 |
| 12 | `browserTracingIntegration` 不再包含 `performance.mark/measure` span（需 `userTimingIntegration`）與互動 span（需 `interactionsIntegration`）；`_experiments` 不再接受 | 本專案未啟用相關選項 | 不命中 |
| 13 | Node >= 20.19.0；TypeScript 最低 5.0.4；React 最低 17 | CI Node 22、TS 5.9、React 19 皆滿足；`.github/workflows/lighthouse.yml:27` 用 `node-version: '20'`（只 `npm ci`，不 build） | 不命中 |
| 14 | 其餘（OpenTelemetry 設定、Next/Astro/Nuxt/React Router/Cloudflare/AWS 等） | 本專案是純 browser SDK | 不命中 |

### 3.3 實測：`beforeSendTransaction` 在 11.9.0 預設下被忽略

在複本以 `@sentry/react@11.9.0` + 自訂 transport 抓 envelope（jsdom，`tracesSampleRate: 1`，手動 `startSpan` 一個 `pageload` 與一個 child）：

- 預設（stream）：`beforeSendTransaction` 呼叫次數 **0**；送出的 envelope item type 是 `span`（`application/vnd.sentry.items.span.v2+json`），沒有 `transaction`；SDK 印出：「`beforeSendTransaction` and `ignoreTransactions` are ignored with `traceLifecycle: 'stream'` (enabled by default). Use `beforeSendSpan` and `ignoreSpans` instead, or set `traceLifecycle: 'static'`.」
- `traceLifecycle: 'static'`：呼叫次數 1，envelope item type 為 `transaction`。

**含義**：`src/lib/sentry.ts:14-48` 與註解（HeadlessChrome / localhost / canary pageload 造成假的「Large Render Blocking Asset」issue，16/17 筆為 HeadlessChrome）所解的問題會復發。文件也明寫 `beforeSendSpan` 無法丟棄 span（「The `beforeSendSpan` callback cannot drop spans」）；丟棄要靠 `ignoreSpans`（只能比對 span 名稱/attribute，**不含 User-Agent**）或 `tracesSampler`。因此 stream 模式下要「擋 HeadlessChrome」需改成**不取樣**（初始化時判斷 UA / localhost 後把 tracing 關掉）。**此改法本文未實作、未驗證**。

錯誤事件的 `beforeSend` 不受影響：`tests/unit/sentry-*.test.ts` + `error-boundary.test.tsx` 共 69 tests 在 11.9.0 下全綠（含 `isNoiseEvent` 三個變體）。`tsc --noEmit` 在 11.9.0 下通過（`ErrorEvent` / `Event` / `EventHint` 型別仍可 import，`src/lib/sentry.ts:1-7`）。

### 3.4 其他實測

- `vite build`（無 token）成功；`sentry` chunk 145,545 -> 158,115 bytes（gzip 48,704 -> 53,463，約 +9.8%），`bundle-size-check.sh` 通過。
- `vite build` + 假 token + 不可達 `SENTRY_URL`：升版前（舊 `sentry-cli`）與升版後（新 `sentry` SDK）都是印出 `[sentry-vite-plugin] Error ... Couldn't finish all operations`，**build 仍 exit 0**（fail-open 行為一致）。新版會印 `ExperimentalWarning: SQLite`（用到 `node:sqlite`；Node 22.23 下僅警告）。
- **未驗證**：用真 token 的實際 source map 上傳 / release 建立是否成功、release 名稱 `tripline@<ver>-<sha>`（`vite.config.ts:15`）在 UI 的呈現。這需要在 CI 或有 token 的環境做（`docs/monitoring/sentry-alerts.md:41` 的 Alert 4 filter 靠這個 release 名稱）。

### 3.5 對現有告警與指標基準的影響（只列文件可支撐的）

| 項目 | 影響 | 依據 |
|---|---|---|
| Alert 1（錯誤量，基準 5–20 events/hr，門檻 100/hr，`sentry-alerts.md:17`） | 錯誤事件機制未被列為 breaking；`attachStacktrace` 對本專案影響小（§3.2 #8）。**但若不處理 §3.3，雜訊 span/transaction 會增加事件總量**，需在升版後第一天看量 | MIGRATION「Span streaming」；§3.3 實測 |
| Alert 2（新 issue，`sentry-alerts.md:24`） | 可能因 `attachStacktrace` 與 `DOMException.code` tag 變動出現一次性新 group；本專案只傳 `Error`，預期少 | MIGRATION 該兩節 |
| Alert 4（crash-free < 99%，`sentry-alerts.md:39`） | **口徑改變**：`crashed` -> `unhandled`、session 由 route 改 page。文件只說「expect the crash-free rate to shift」，**方向與幅度未寫**，本文也不推測 | MIGRATION 兩節 |
| Performance 基準（Web Vitals / transaction 名稱 / p75） | 頁面載入 vitals「expect to drop」、bfcache 另成群、transaction 名稱變 `Pageload`/`Navigation`。舊基準不可比 | MIGRATION「Web vitals…」「span names」 |
| `daily-check.js` / `daily-report.js` | 用 issues API，不依賴上述；不受影響 | `scripts/daily-check.js:75-81` |
| 免費額度 | `tracesSampleRate: 0.1`（`src/lib/sentry.ts:109`）不變，但 streaming 後「一個 trace = 多個 span item」的**計量方式**我沒有在文件找到原文：**未證實** | — |

### 3.6 風險、範圍、建議

- **風險：高**（不是改碼難，是觀測資料斷層與告警失準）。程式改動預估 `src/lib/sentry.ts` 一檔 + `vite.config.ts` 版本（約 20 行）+ 對應測試調整。
- **建議路線（供開票）**：
  1. 先升 `@sentry/vite-plugin` 11.9.0（build-time，行為實測 fail-open 一致），在 CI 用真 token 驗一次上傳。
  2. 再升 `@sentry/react` 11.9.0，**同一 PR 明確決定**：(a) 先 `traceLifecycle: 'static'` 保留 `beforeSendTransaction` 與舊的 transaction 語意（過渡，文件稱未來會移除）；(b) 或接受 stream 並重寫噪音過濾（不取樣 HeadlessChrome/localhost）。**我建議 (a) 為第一步**，把「SDK 升版」與「遷移到 span streaming」拆兩個 PR。
  3. 升版前截一份 Sentry UI 現況（Alert 4 近 30 天值、LCP/INP p75）當基準；升版後在 PR 註明「Sentry UI 已套用 on YYYY-MM-DD」（`docs/monitoring/sentry-alerts.md` 的 Threshold revision flow）。
  4. `.github/dependabot.yml:40` 的 `sentry` group 會把 `@sentry/*` 一起開 PR，與上面「先 plugin 後 SDK」衝突，升版時要調整。
- **驗證**：`npx vitest run tests/unit/sentry-*.test.ts tests/unit/error-boundary.test.tsx`；`npx tsc --noEmit`；`npm run build`；CI（有 token）build log 檢查 `[sentry-vite-plugin]` 無 Error；上線後 Sentry UI 看 `trace_lifecycle` attribute 與 transaction/span 是否出現。

---

## 4. dotenv 17 / 18 逐條（補讀原文）

| 版本 | 變更（[CHANGELOG](https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md)） | 命中 |
|---|---|---|
| 17.0.0 | `quiet` 預設 false，`config()` 預設印 log | 不命中（只用 `parse()`，`scripts/lib/load-env.js:26`） |
| 17.1–17.4 | log 文字調整、加 `skills/` | 不命中 |
| 18.0.0 | 新增 CLI；新增 `fast` parser（opt-in）；注入訊息改 stderr；**移除** tips、skill files、西班牙文 README、`.env.vault`、preloading | 不命中（無 vault、無 `-r dotenv/config`） |
| 18.0.1–18.0.9 | fast parser 邊界、`DOTENV_QUIET`、`import dotenv/config` 預設 quiet、型別宣告 | 不命中 |

`load-env.mjs:33-36` 的註解已經記載「17+ 把 tip 印到 stdout 會 `parse error near '}'`」這個歷史雷，本專案以 `parse()` 繞開，所以升 18 只剩 dependency 版本號的差異。

---

## 5. jsdom 26 -> 30 逐條（補讀 27/28/29/30 原文）

來源：[jsdom Releases](https://github.com/jsdom/jsdom/releases)（本節逐版）。

| 版本 | 重點（原文） | 本專案命中判斷 |
|---|---|---|
| 27.0.0 | Node 20 起跳；`element.click()` 改發 `PointerEvent`；選擇器引擎 `nwsapi` -> `@asamuzakjp/dom-selector`；`cssstyle` 升級；UA stylesheet 改 HTML Standard 版；`pattern=""` 改 `v` flag；`VirtualConsole.sendTo()` 更名 `forwardTo()`；tough-cookie 把 `http://localhost/` 視為 secure context | `.click()` 在 `tests/unit` 有 13 處，React 事件委派對 `PointerEvent`（`MouseEvent` 子類）不挑；repo 內**無** `VirtualConsole` / `JSDOM(` / `document.cookie`（grep 無命中） |
| 27.0.1 | 不慎把 Node 下限提高到 `^20.19 || ^22.12 || >=24` | — |
| 27.1–27.4 | CSS 解析（`@acemir/cssom`）、`TextEncoder/Decoder`、`Range` leak 修正 | 不命中 |
| 28.0.0 | 資源載入自訂 API 全面重寫；`WebSocket` 不再依 origin 節流（regression）；`<iframe>` MIME sniffing | 本專案測試無 `resources` / `ResourceLoader` / iframe / WebSocket 使用（grep 無） |
| 28.1.0 | `blob.text()` 等、`getComputedStyle` 依 specificity | 不命中 |
| 29.0.0 | Node `22.13+`；**CSSOM 整個重寫**（取代 `@acemir/cssom`、`cssstyle`，改 `css-tree`）；`selectorText` setter 驗證；bad port 封鎖 | `getComputedStyle` 在 jsdom 環境下只出現在 `src/pages/TripPage.tsx:164,661,686`（以及 e2e/純原始碼 grep 型測試，後者不經 jsdom）；單元測試未斷言 computed style（`tests/unit/shell-visual-followups.test.ts:62` 等僅註解） |
| 29.0.1–29.1.1 | `getComputedStyle` 修補與提速 | 同上 |
| 30.0.0 | **Node 下限 `^22.22.2 || ^24.15.0 || >=26.0.0`**；新增 `CSS.escape/supports` 等 | **Node 25 不在範圍**；CI `'22'` 解析到最新 22.x 可滿足 |
| 30.0.1–30.1.3 | `getComputedStyle` 修補、range 提速、其他修補（[v30.1.0](https://github.com/jsdom/jsdom/releases/tag/v30.1.0)） | 不命中 |

**peer / engines（npm registry）**：`jsdom@30.1.3` `engines.node = ^22.22.2 || ^24.15.0 || >=26.0.0`；vitest 5 的 `jsdom` peer 為 `*`。
**本專案命中的設定**：`vitest.config.js:55` `environment: 'jsdom'`（`unit-dom` project），`vitest.config.js:57` `setupFiles: ['./tests/setup-dom.js']`。`tests/setup-dom.js:7-27` 的 localStorage descriptor 防護是為 Node 25 的內建 `localStorage` 寫的；vitest 5 的 changelog 也有「Don't emit localStorage warnings on Node 26」（[v5.0.0](https://github.com/vitest-dev/vitest/releases/tag/v5.0.0)）。
**已知的 jsdom 測試註解**：`tests/unit/timeline-rail-toolbar-pencil.test.tsx:78` 記載「jsdom 26 的 `showPopover()` 不 fire React `onToggle`」。升到 30 後 popover 行為是否改變：**未證實**（我沒有逐版讀 popover 相關條目；實測該檔測試仍綠）。

**實測**：`jsdom@30.1.3` + `jest-dom@7.0.1` + `vitest@5.0.5` + `marked@18` + `@sentry/react@11` 同裝，`unit-dom` 203 files / 1838 tests 全綠，與基準相同。
**風險**：中（不是因為測試壞，而是 Node 下限與「測試綠但語意與真瀏覽器偏離」的長期成本）。
**建議**：與 vitest 5 同批（Batch 2）。記憶中「本機全量 `npm test` 偶發紅燈（DOM 測試輪流掛）」未在本次實測重現（單次跑，樣本不足，不能據此宣稱已修好）。

---

## 6. vitest 4 -> 5 專節

來源：[v5.0.0 release](https://github.com/vitest-dev/vitest/releases/tag/v5.0.0)、[Migration guide](https://vitest.dev/guide/migration)；5.0.1–5.0.5 為修補（[v5.0.5](https://github.com/vitest-dev/vitest/releases/tag/v5.0.5) 等）。

### 6.1 engines / peer（npm registry，`vitest@5.0.5`）

- `engines.node = ^22.12.0 || ^24.0.0 || >=26.0.0`；`peerDependencies.vite = ^6.4.0 || ^7.0.0 || ^8.0.0`（本專案 `vite@8.3.5`）、`jsdom: *`、`@types/node: ^22 || >=24`。
- `vitest@5.0.5` 的 dependencies 只含 `@vitest/mocker`（不含 `@vitest/runner` / `@vitest/snapshot` / `@vitest/expect`）：`@vitest/runner` 已內嵌「do not publish it anymore」（v5.0.0 Breaking Changes），`npm view @vitest/runner dist-tags` 的 `latest` 仍停在 4.1.11、v5 只剩 `beta` 標籤。

### 6.2 逐條 breaking 與命中（grep 證據）

| Breaking（原文摘要） | 命中 |
|---|---|
| `clearMocks` 預設 true | 不命中：`vitest.config.js:38-39` 已設 `clearMocks: true, restoreMocks: true` |
| `vi.mock/unmock/hoisted` 在 function/block/`describe` 內會 throw | 不命中：`grep -rnE "^\s{2,}vi\.(mock|hoisted|unmock)\(" tests` 無結果 |
| 未 await 的 `resolves`/`rejects` 斷言失敗 | 不命中：grep 無未 await 的 `.resolves/.rejects` |
| `expect.poll` 逾時失敗 | 單元測試不命中（只在 `tests/e2e/*.spec.js`，Playwright 的 `expect.poll`，非 vitest） |
| `toHaveTextContent` strict、新增 `toMatchTextContent` | 本專案 101 處 `toHaveTextContent`（`tests/`）使用 jest-dom 的 matcher；在 vitest 5.0.5 + jest-dom 6.9.1 與 7.0.1 下**皆全綠**。該 breaking 的歸屬（vitest 內建 / browser 模式 matcher）我沒讀到 commit 原文：**未證實**，僅以實測為據 |
| `sequential` 選項移除 | 不命中（grep 無） |
| inline projects 預設 `extends: true` | 不命中：`vitest.config.js:47,61` 已明寫 `extends: true`；`vitest.config.api.mts` 無 projects |
| 不再往上層目錄找 config | 不命中（config 皆在 repo 根，`package.json:17-18` 的指令從根跑） |
| `@vitest/runner`、`@vitest/snapshot` 內嵌，不再發佈 | **命中 `package.json:40-41`**：兩者為 devDependencies 但**全 repo 沒有任何 import**（`grep -rn "@vitest/" src tests scripts vite.config.ts vitest.config.*` 只有 `package.json` 與 `.github/dependabot.yml:51`）；加入原因：commit `20d5427e`（vitest 3 -> 4 升版）當時順手加入，訊息未說明用途。實測移除兩者後 `unit-dom` 全綠 |
| `vi.fn()` class mock 保留 prototype、`vi.useFakeTimers` 會 mock `Temporal` | `useFakeTimers` 在 46 個測試檔；`Temporal` 在 `src tests` 無使用（grep 無）；全量實測綠 |
| `toThrow("")` 語意、`-t` 改用 `>` 分隔、`VITEST_POOL_ID` 改 1-based、reporter 輸出改到 `.vitest/` | 不命中：`toThrow("")` 無；`package.json` / `.github/workflows` 無 `-t` / `testNamePattern` / `VITEST_POOL_ID`（grep 無）；本專案用預設 reporter |
| jsdom/happy-dom 的 `window` 賦值會傳遞到底層 | 不命中（實測綠；`tests/setup-dom.js:5-60` 只做缺值補丁） |
| `benchmark` 重寫 | 不命中（無 bench） |
| `Assertion<R,T>` 型別變動、自訂 matcher 要 augment `Matchers` | 不命中：`tests/` 與 `src/` 無 `interface Assertion/Matchers`、無 `declare module 'vitest'`（grep 無）；`tests/` 也不在 `tsc` 範圍（`tsconfig.json` `include: ["src/**/*"]`） |

### 6.3 實測結果（複本，Node v22.23.4，`npm i -D vitest@5.0.5 @vitest/snapshot@5.0.5` 並移除 `@vitest/runner`）

| 範圍 | 升版前 | vitest 5.0.5 |
|---|---|---|
| `vitest run --project unit-dom` | 203 files / 1838 tests 綠 | 203 / 1838 綠 |
| `vitest run --project unit-node` | 318 files，3 fail（`repository-retirement`，複本無 `.git`） | 同樣 3 fail，失敗名單 `diff` 為空 |
| `vitest run --config vitest.config.api.mts` | 3 次中 1 次 1302 全綠（Node 22）；另 2 次分別 64 fail（Node 26）、28 fail（Node 22） | 3 次中 2 次 1302 全綠（Node 26 一次、Node 22 一次）；另 1 次 25 fail（Node 22） |

**api 套件的 flaky 說明**：失敗原因皆為 `connect EADDRNOTAVAIL 127.0.0.1:<port>`（ephemeral port 耗盡，`vitest.config.api.mts` 註解已記載此歷史問題，且與 Miniflare 單例有關），**升版前（基準）自己也出現 28 / 64 個同型失敗**，失敗檔案每次不同，因此不能把 api 的紅燈歸因給 vitest 5；但也代表 **api 套件的一次綠燈證據力有限**——開 PR 時應在乾淨環境連跑 2–3 次。
**另一個 `Not implemented: window.scrollTo`**：基準與 5.0.5 各 112 次相同（jsdom 既有雜訊）。

### 6.4 同批相依

- vitest 5 需要 Node ≥ 22.12（CI `'22'` OK；**本機 Node 25 不在範圍**，vitest 5.0.5 在 Node 26.12.1 與 22.23.4 實測皆綠，Node 25 未測）。
- 移除 `@vitest/runner` + `@vitest/snapshot` 與 `vitest` 升版必須同一個 commit（保留 `^4.1.10` 會裝回 4.1.x 的無用套件並被 dependabot 的 `testing` group 追蹤，`.github/dependabot.yml:49-51`）。
- `jsdom`、`@testing-library/jest-dom` 不是必須與 vitest 同批（peer 皆寬鬆），但實測是整組一起綠；我建議 `jsdom` 同批（避免 Node 下限分兩次調整），`jest-dom` 放 Batch 1。

**風險**：中。**預估改動**：`package.json`（3 行 + 移除 2 行）、lockfile；若 CI 先釘 Node 則加 `.nvmrc`。**驗證**：`npm test` 與 `npm run test:api`（各連跑兩次）、比對測試總數（1838 + 2820 + 1302 這組數字；注意 unit-node 在真 repo 有 `.git`，3 個 `repository-retirement` 應為綠）。
**建議**：現在升（Batch 2），PR 內順手加 `engines` 或 `.nvmrc`，並在描述寫明 Node 25 不支援。

---

## 7. peer / 相容性矩陣

`.npmrc:1` 為 `legacy-peer-deps=true`，下表來自 `npm view <pkg> peerDependencies engines`（逐一查證），**不是**靠 npm 報錯。

| 套件@版本 | 對 vite | 對 Node | 其他 peer |
|---|---|---|---|
| `vite@8.3.5`（現況） | — | — | — |
| `vitest@5.0.5` | `^6.4 \|\| ^7 \|\| ^8` OK | `^22.12 \|\| ^24 \|\| >=26`（**25 不行**） | `jsdom: *`、`@types/node ^22 \|\| >=24`（`@types/node` 現為 transitive，未直接宣告） |
| `@vitejs/plugin-react@6.1.2`（現況） | `^8.0.0` OK | `^20.19 \|\| >=22.12` | `babel-plugin-react-compiler` 等為 optional |
| `@tailwindcss/vite` | `^5.2 \|\| ^6 \|\| ^7 \|\| ^8` OK | — | — |
| `vite-plugin-pwa@2.0.0` | `^3.1 … ^8` OK | `>=20.19.0` | `workbox-build ^7.4.1`、`workbox-window ^7.4.1`（現裝 7.4.1，OK）、`@vite-pwa/assets-generator`（optional，未用） |
| `@sentry/vite-plugin@11.9.0` | 無 vite peer（由 `@sentry/bundler-plugins@11.9.0` 承接） | `>=20.19 <22 \|\| >=22.12 <23 \|\| >=23.2` | — |
| `@sentry/react@11.9.0` | — | `>=20.19 <22 \|\| >=22.12 <23 \|\| >=23.2` | `react 17–19`（OK）、`react-router 6–8`（optional；本專案 `react-router-dom@7`，未啟用 Sentry router integration） |
| `jsdom@30.1.3` | — | `^22.22.2 \|\| ^24.15 \|\| >=26` | `canvas ^3.2.3`（optional） |
| `@testing-library/jest-dom@7.0.1` | — | `>=22` | `@testing-library/dom >=10 <11`（OK）、`vitest >=0.32`（optional） |
| `typescript-eslint@8.72.0` | — | `^18.18 \|\| ^20.9 \|\| >=21.1` | **`typescript >=4.8.4 <6.1.0`**、`eslint ^8.57 \|\| ^9 \|\| ^10` |
| `typescript@7.0.2` | — | — | **無 JS API**（見 §8） |
| `marked@18.1.1` | — | `>=20` | — |
| `concurrently@10.0.6` | — | `>=22`（原文） | — |

**互卡結論**：
1. **vitest 5 / vite 8.3.5 / @vitejs/plugin-react 6.1.2 / @tailwindcss/vite / vite-plugin-pwa 2：互不衝突**（vite 軸全部涵蓋 8.x）。
2. **TS 7 與 typescript-eslint 8.72 互卡**（硬互斥，見 §8）；TS 6.0.x 與 typescript-eslint 8.72 相容（`<6.1.0`）。
3. **Node 是真正的串聯約束**：vitest 5（≥22.12）→ jsdom 30（≥22.22.2）→ Sentry 11（≥22.12 或 20.19）；CI `'22'` 全滿足，`lighthouse.yml:27` 的 `'20'` 只跑 `npm ci` 與 lighthouse，會對 vitest/jsdom 噴 `EBADENGINE` 警告但不會失敗（`.npmrc` 無 `engine-strict`）；建議順手改 `'22'`。本機需 Node 22 / 24 / 26。
4. `@sentry/vite-plugin` 11 與 `@sentry/react` 11 之間沒有 peer 綁定，可分兩個 PR；但兩者版號鎖步（皆 11.9.0）。

---

## 8. TypeScript 5.9 -> 6.0 -> 7.0 專節

來源：[Announcing TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)、[Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)；[microsoft/TypeScript Releases](https://github.com/microsoft/TypeScript/releases)（v6.0.3、v7.0.2）。

### 8.1 原文要點

- **6.0**：`strict` 預設 true；`module` 預設 `esnext`；`target` 預設當年 ES；`types` 預設 `[]`；`rootDir` 預設 tsconfig 所在目錄；`baseUrl` deprecated（可用 `"ignoreDeprecations": "6.0"` 暫時消音）；`esModuleInterop`/`allowSyntheticDefaultImports` 不可再設 false；`moduleResolution: node10`、`target: es5`、`downlevelIteration`、`--outFile` 等 deprecated/移除。
- **7.0**：原生編譯器；上述 deprecated 項**全部變硬錯誤**（`baseUrl` 不再支援，「Make `paths` relative to the project root」）；`types` 預設 `[]`；**「TypeScript 7.0 does not ship with an API」**，7.1 預計提供新（不同）API；舊 API 可用 `@typescript/typescript6` 相容套件（npm alias）；typescript-eslint 等需靠 alias。

### 8.2 本專案命中（grep + 實測）

| 項目 | 位置 | 6.0.3 | 7.0.2 |
|---|---|---|---|
| `baseUrl: "."` | `tsconfig.json:20` | **TS5101 錯誤**（需 `ignoreDeprecations` 或移除） | **TS5102：選項已移除** |
| `types` 預設 `[]` | `tsconfig.json` 沒有 `types`（`tsconfig.functions.json:4` 有） | 前端 `src/` 內多處 `google` namespace 找不到（`MapFabs.tsx`、`TpMap.tsx`、`useGoogleMap.ts` 等）——因為 `@types/google.maps` 不再自動納入 | 同左 |
| `esModuleInterop: true`、`target: ES2020`、`moduleResolution: bundler`、`strict: true` | `tsconfig.json:3,5,8,9` | 不受影響 | 不受影響 |
| `/// <reference types="vite/client" />` | `src/vite-env.d.ts:1` | 不受影響（顯式引用） | 同左 |
| `typescript-eslint` / ESLint gate | `eslint.config.mjs:14,23,43`（`tseslint.parser`）、`ci.yml` 的 `npm run lint` | OK：6.0.3 下 `eslint "src/**/*.{ts,tsx}" "functions/**/*.ts"` 無錯 | **啟動即失敗**：「typescript-eslint does not support TS 7.0 … run typescript-eslint using the TS 6 API」（追蹤 [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)） |

**實測方式**：複本中安裝 `typescript@6.0.3` / `7.0.2`，用**只改兩處**的 tsconfig（拿掉 `baseUrl`、`paths` 改指絕對路徑；加 `types: ["google.maps"]`）跑 `tsc --noEmit`：6.0.3 與 7.0.2 對 `src/` 與 `functions/` 皆 **0 錯誤**，與 5.9.3 一致。`require('typescript')` 在 7.0.2 只有 2 個 export、`createSourceFile` 為 `undefined`。

### 8.3 結論與路線

- **TS 7：不升**。阻塞 = typescript-eslint（硬互斥）；繞法需 `"typescript": "npm:@typescript/typescript6@^6.0.2"` + 另裝 `@typescript/native`（官方 blog 的 side-by-side 建議），npm registry 上 `@typescript/typescript6` 目前 `latest = 6.0.2`。這會讓 `tsc` 與 ESLint 用兩個不同編譯器，**本文未驗證該組合**。
- **TS 6.0.x：可升（Batch 6）**。必要改動：移除 `baseUrl`（`paths` 的 `./src/*` 已是相對 tsconfig，保留即可）、`tsconfig.json` 加 `"types": ["google.maps"]`（若有其他全域型別需求再補）。這兩項同時也是升 7 的前置，做完 7 只剩工具鏈問題。
- 有 `marked@18` 已把自己的 TS 升到 6（v18.0.0 原文），與本專案 5.9 無交互影響（marked 內含型別宣告，`skipLibCheck: true`）。
- **風險**：6.0 中（小改動但會影響 CI 的兩條 `tsc`）；7.0 高（阻塞）。**驗證**：`npx tsc --noEmit`、`npx tsc --noEmit -p tsconfig.functions.json`、`npm run lint`（記憶：TS5101 會讓舊版 tsc 短路假綠，驗證時要看到真的跑完）。

---

## 9. 仍為「未證實」的項目

1. 真實 token 下 `@sentry/vite-plugin@11.9.0` 的 source map 上傳與 release 建立（§3.4）。
2. Sentry 11 streaming 後的免費額度計量方式（§3.5）。
3. Sentry 11 後 Alert 4（crash-free）的方向與幅度（官方僅說會 shift）。
4. 在 stream 模式下用 `tracesSampler` / 條件初始化擋 HeadlessChrome 的具體寫法（§3.3，未實作）。
5. vitest 5「`toHaveTextContent` strict」的歸屬（內建或 browser 模式 matcher）；僅知 101 處在本專案實測綠（§6.2）。
6. jsdom 30 對 popover（`showPopover` / `onToggle`）行為是否改變（§5）；該路徑本來就不在 jsdom 驗。
7. Node 25 上跑 vitest 5 / jsdom 30 的行為（兩者 engines 不含 25，只測了 22.23.4 與 26.12.1）。
8. `typescript-eslint` 在 `@typescript/typescript6` alias 下的實際運作（§8.3）。
9. 真瀏覽器 / CI e2e（Playwright）在升版後的結果——本次未跑 e2e（記憶：e2e 只在 CI 跑）。
10. `marked` 升級後 AI 聊天實際畫面（只做了字串差異比對與單元測試）。
11. `dist/registerSW.js` 檔名在 vite-plugin-pwa 2 下是否不變（§2.7）。

---

## 10. 實測環境與限制

- 位置：`/private/tmp/claude-501/-Users-ray-Projects-trip-planner/c51c861e-135b-4464-84ec-babd112f84db/scratchpad/{w,w5,w6}`（`rsync` 複本，`npm ci` 後以 `cp -c` 克隆；`w` = 基準、`w5` = 僅 vitest 5、`w6` = 全組合）。正式 repo 的 `git status` 全程乾淨。
- Node：用 npm 安裝的 `node@22`（v22.23.4）跑多數測試；`node -v` 在 session 起始為 v25.9.0，之後同一台機器變為 v26.12.1（原因未查）。vitest 5.0.5 在 v26.12.1 的 `unit-dom` 與 `test:api` 皆綠。
- 複本限制：沒有 `.git`（`repository-retirement` 3 個測試必紅，升版前後相同）；`npm ci` 對 `workerd` postinstall 未批准，但 Miniflare 相關測試仍通過；`scripts/logs` 未複製。
- `test:api` 受 ephemeral port 耗盡影響，單次結果不可全信（§6.3）。
- 未跑：Playwright e2e、`wrangler pages dev` 真實啟動、`/browse` 視覺驗證、Sentry 真上傳。

---

## 11. 一手來源

- npm registry：`npm view <pkg> dist-tags / peerDependencies / engines / dependencies`（2026-10-23 查）。
- vitest：https://github.com/vitest-dev/vitest/releases/tag/v5.0.0 、 https://vitest.dev/guide/migration
- jsdom：https://github.com/jsdom/jsdom/releases （27.0.0 / 28.0.0 / 29.0.0 / 30.0.0 / 30.1.x）
- Sentry：https://github.com/getsentry/sentry-javascript/blob/develop/MIGRATION.md 、 https://github.com/getsentry/sentry-javascript/releases/tag/11.0.0
- dotenv：https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md
- marked：https://github.com/markedjs/marked/releases （18.0.0–18.1.1）
- concurrently：https://github.com/open-cli-tools/concurrently/releases/tag/v10.0.0
- jest-dom：https://github.com/testing-library/jest-dom/releases/tag/v7.0.0
- vite-plugin-pwa：https://github.com/vite-pwa/vite-plugin-pwa/releases/tag/v2.0.0
- TypeScript：https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ 、 https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- typescript-eslint TS7 追蹤：https://github.com/typescript-eslint/typescript-eslint/issues/10940（由 typescript-eslint 自身錯誤訊息指向，**我未另外開頁讀**）

---

## 12. 建議的分批升級計畫

每批 = 一個可獨立 merge 的 PR；批內套件同升；批與批之間可獨立回滾。路線依 `CLAUDE.md` 走 `/implement`（單 session 可完成者），Sentry 與 TS 較大，建議各自先 `/grill-with-docs`。

| 批 | 內容 | 前置 | 驗證（必跑） | 風險 |
|---|---|---|---|---|
| **0（可併入 1）** | 釘 Node：新增 `.nvmrc`（22）與 `package.json` `engines`；`lighthouse.yml:27` 改 `'22'` | 無 | `npm ci` 無 `EBADENGINE`；CI 綠 | 極低 |
| **1 維護性小升** | `concurrently` 10.0.6、`dotenv` 18.0.9、`@testing-library/jest-dom` 7.0.1 | 批 0 | `npm run dev` 手動起一次；`tests/unit/load-env-script.test.ts` `env-local-parse.test.ts`；`npm test`（`unit-dom` 用到 jest-dom）；`eval "$(node scripts/lib/load-env.mjs .env.local)"` 比對 | 低 |
| **2 測試鏈** | `vitest` 5.0.5 + 同 commit 移除 `@vitest/runner`、`@vitest/snapshot`；`jsdom` 30.1.3 | 批 1（jest-dom 7）、批 0（Node） | `npm test` 與 `npm run test:api` **各連跑 2 次**，比對檔案/測試數（unit-dom 203/1838、unit-node 318/2820、api 116/1302）；`mutation`：故意改壞一個 DOM 測試的實作確認轉紅（避免新環境下恆真）；`dependabot.yml:49-51` 的 `testing` group 不用改 | 中 |
| **3 marked** | `marked` 18.1.1 | 無（可與 2 並行） | `markdown-text-xss`、`sanitize-uri-attrs`、`sanitize-href-relative`、`round7a-security`、`v2_31_91-chat-md-link-style`；`/browse` 抽查聊天含清單/表格的回覆 | 低 |
| **4 PWA** | `vite-plugin-pwa` 2.0.0 | 無 | `npm run build`、`node scripts/verify-sw.js`、確認 `dist/registerSW.js` 存在（`src/lib/sentry.ts:30` 依賴）、`tests/unit/sentry-noise-filter.test.ts` | 低 |
| **5a Sentry plugin** | `@sentry/vite-plugin` 11.9.0 | 批 0 | CI（含 `SENTRY_AUTH_TOKEN`）build log 無 `[sentry-vite-plugin] Error`；Sentry UI 看到新 release 與 source map | 中 |
| **5b Sentry SDK** | `@sentry/react` 11.9.0，**同 PR 內決定** `traceLifecycle: 'static'`（建議）或重寫噪音過濾；更新 `docs/monitoring/sentry-alerts.md`（Alert 4 口徑、基準）；調整 `dependabot.yml:40` group | 5a、截下舊基準 | `tests/unit/sentry-*.test.ts`、`error-boundary.test.tsx`、`tsc`、build；上線後 24 小時觀察（Alert 1/2/4、`/api` 呼叫的 span 名稱、HeadlessChrome 是否漏進來） | **高（觀測）** |
| **6 TS 6.0** | `typescript` 6.0.3：移除 `baseUrl`、加 `types: ["google.maps"]` | 無 | `tsc --noEmit` 兩份 tsconfig、`npm run lint`、`npm run build` | 中 |
| **暫緩** | `typescript` 7.x | typescript-eslint 官方支援（#10940）或接受 `@typescript/typescript6` alias 雙編譯器 | — | 高 |

**順序理由**：0/1 風險最低且為 2 的前置；2 先於 5b 是因為 Sentry 的單元測試也跑在 vitest 上，測試鏈穩定後再動觀測面，歸因才清楚；3、4 彼此與 2 無相依，可平行但不同 PR；5b 放最後之一，因為它需要 owner 先決定基準（§3.6）；6 與其餘無相依，可任意時點做，但不要與 2 同 PR（兩者都會動 CI 的紅綠判讀）。
