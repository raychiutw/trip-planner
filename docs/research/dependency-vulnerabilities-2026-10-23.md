# 依賴漏洞與升版風險盤點

- 研究日期 / 全部來源抓取日期：**2026-10-23**
- 範圍：repo 根目錄 `package.json` / `package-lock.json`（repo 內只有這一份 `package.json`，`functions/` 等子目錄無獨立 package.json，已用 `find` 確認）。
- 方法：把 `package.json` + `package-lock.json` 複製到 scratchpad 後 `npm ci --ignore-scripts`（乾淨環境，不受本機 node_modules drift 影響），再跑 `npm audit --json`、`npm outdated --json`。每筆 GHSA 用 `gh api /advisories/<GHSA>` 取 GitHub Advisory Database 原文（嚴重度、受影響範圍、修復版本）；最新版用 `npm view <pkg> dist-tags`；major 的 breaking changes 讀官方 GitHub Releases / MIGRATION。
- 限制：
  - 「可達性」是讀本專案程式碼與依賴原始碼後的判斷，**沒有**實際跑 PoC。標「未證實」者即無法驗證。
  - `npm audit` 回報的 `fixAvailable`（要降到 `miniflare@4.20250508.2`、`serve@10.0.2`）是錯的方向，**不要跑 `npm audit fix --force`**。
  - `npm audit` 的 severity 與 advisory 原文有出入處以原文為準（見各表）。
- 審計結果總數（lockfile 現況）：13 個套件有漏洞（critical 3 / high 8 / moderate 2）。

## 結論摘要

| 類別 | 項目 |
|---|---|
| (a) 必須立刻升 | `dompurify` -> 3.4.17（runtime 依賴、critical，但路徑多半不可達，仍建議立刻升因為只要改 overrides 一行）；`vite` -> 8.3.5（開發 server 的 6 筆）；`wrangler` -> 4.152.0；`undici` / `sharp` 經 override 修（見下）；`shell-quote` -> >=1.11.0（經 `concurrently` 9.2.5） |
| (b) 可安全升 | 其餘 minor / patch：react/react-dom 19.3.1、react-router-dom 7.18.4、vitest + `@vitest/*` 4.1.12、`@sentry/react` 10.76.2、`@sentry/vite-plugin` 5.4.1、playwright 1.64.1、eslint 10.13.0、typescript-eslint 8.72.0、`@vitejs/plugin-react` 6.1.2、`@cloudflare/workers-types`、axe-core 4.14.0、nodemailer 10.2.1、oidc-provider 9.13.0、sharp 0.35.5 等 |
| (c) 需獨立評估 | vitest 5、TypeScript 7、`@sentry/react` 11、jsdom 29、marked 18、dotenv 18、vite-plugin-pwa 2、`@testing-library/jest-dom` 7、concurrently 10 |

## 1. 漏洞明細（逐筆對照 advisory 原文）

Advisory 原文 URL 格式：`https://github.com/advisories/<GHSA>`（資料取自 `https://api.github.com/advisories/<GHSA>`）。

### 1.1 dompurify（transitive，runtime 依賴樹內）

- 依賴鏈：`html2pdf.js@0.14.0 -> dompurify@3.4.16`、`html2pdf.js -> jspdf@4.2.1 -> dompurify`。目前被 `package.json` 的 `overrides.dompurify: ^3.4.16` 鎖在 3.4.16（正好落在受影響範圍上限）。
- 現行 3.4.16 受影響；修復版本 **3.4.17**（`npm view dompurify dist-tags` 的 latest = 3.4.17）。

| GHSA | 嚴重度（advisory） | 受影響 | 修復 | 摘要 |
|---|---|---|---|---|
| [GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7) | critical | `>=3.4.4 <=3.4.16` | 3.4.17 | `SAFE_FOR_TEMPLATES` 繞過，shadow root 內容 |
| [GHSA-mrv2-3pqr-j5jr](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr) | high | `<=3.4.16` | 3.4.17 | `IN_PLACE` + hook 移除 parent/sibling 後事件處理器仍有效 |
| [GHSA-c6gr-qvv4-5v3f](https://github.com/advisories/GHSA-c6gr-qvv4-5v3f) | low | `<=3.4.16` | 3.4.17 | `PARSER_MEDIA_TYPE=application/xhtml+xml` 時 SMIL guard 被跳過 |

- **可達性（部分驗證）**：本專案 `src/` 與 `functions/` 沒有直接用 dompurify。唯一 runtime 入口是 `src/components/print/renderTripPrintPdf.tsx` 動態載入 `html2pdf.js`，並以 `.from(target)`（傳入 DOM element）產 PDF。讀 `node_modules/html2pdf.js/src/utils.js`：只有 `opt.innerHTML` 才會走 `DOMPurify.sanitize`；`jspdf` 只在 `html()` 且帶 `opt.innerHTML` 時才載入 dompurify。我確認專案呼叫沒有傳 `innerHTML`，所以三筆在現行用法下**很可能不可達**；但「很可能」是讀碼推論，**未做動態驗證**。
- 建議：把 `overrides.dompurify` 改為 `^3.4.17`（同時更新 `_overrides_note`）。成本極低，順便消除 critical 警示。

### 1.2 vite（direct，僅 dev server）

- 現行 `vite@8.3.0`（lockfile），範圍 `>=8.3.0 <=8.3.2` 受影響；修復 **8.3.3**，目前 latest **8.3.5**。
- 6 筆（皆為 `vite` 套件 8.3.x 的修復版 8.3.3）：

| GHSA | CVE | 嚴重度（advisory） | 摘要 |
|---|---|---|---|
| [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv) | CVE-2026-112943 | medium | launch-editor `escapeCmdArgs()` 缺 `%` escape（Windows） |
| [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw) | CVE-2026-112944 | medium | launch-editor editor CLI flag 誤判，部分 editor 可任意指令執行 |
| [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) | CVE-2026-112942 | high | launch-editor `fs.existsSync()` 檢查可繞過（Windows） |
| [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw) | CVE-2026-112945 | low | custom middleware 跨來源 script 執行 |
| [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) | CVE-2026-112946 | medium | `server.fs.allow` 之外的檔案可能被提供（非 Windows，路徑巧合） |
| [GHSA-vfpm-58rq-9qcg](https://github.com/advisories/GHSA-vfpm-58rq-9qcg) | CVE-2026-112947 | medium | `?vite-wasm-instance` 洩漏 `server.fs` 外檔案前 4 bytes |

- 注意：`npm audit` 把 vite 整體標 high，是因為 launch-editor 那筆 high（Windows 限定）；其餘 advisory 原文是 low/medium。
- **可達性**：只影響 `vite` dev server（`npm run dev`、`vite preview`）。prod 是 CF Pages 靜態產物，不含 vite server。開發機是 macOS，Windows 限定項不適用；`playwright.config.js` 的 webServer 用 `vite preview`（CI 也會跑），preview 是否受 `server.fs` 類 advisory 影響：**未證實**。
- 建議：`vite` -> **8.3.5**（patch，同 major 內；`@vitejs/plugin-react@6.1.2` peer `vite ^8.0.0`、`@tailwindcss/vite` 仍相容 8.x，見 npm registry peerDependencies）。

### 1.3 wrangler / miniflare / undici / sharp（direct，dev / test 專用）

依賴鏈（`npm ls` 實測）：
- `wrangler@4.131.0 -> miniflare@5.20260910.0-alpha -> undici@7.29.0 / sharp@0.35.4`
- direct `miniflare@4.20260730.0 -> undici@7.28.0 / sharp@0.35.2`（`npm view miniflare@4.20260730.0 dependencies` 確認 undici `7.28.0`、sharp `0.35.2`）
- direct `sharp@0.35.4`

**undici**（修復版 7.29.1；7.29.0 僅修一部分）

高嚴重度 / 其餘代表（15 筆全部修在 7.29.1，advisory 原文）：

| GHSA | 嚴重度（advisory） | 摘要 |
|---|---|---|
| [GHSA-4cwx-7wf7-3272](https://github.com/advisories/GHSA-4cwx-7wf7-3272) | high 7.4 | private cache directive 跨使用者資訊洩漏（修 7.29.0） |
| [GHSA-rfgv-xxqx-mfg5](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5) | high 7.5 | 未請求的 WebSocket subprotocol 造成 DoS |
| [GHSA-w293-vg96-wgc3](https://github.com/advisories/GHSA-w293-vg96-wgc3) | high 7.4 | BalancedPool 丟掉 connect options 導致 TLS 驗證繞過 |
| 其餘 12 筆 | low / medium | 見 `npm audit` 清單；皆為 `>=7.0.0 <7.29.0` 或 `<7.29.1`（含 GHSA-8xcm-r25x-g524、GHSA-jr45-8vmc-qm54、GHSA-m8rv-5g2x-5cg5、GHSA-v3r7-h72x-cjcm、GHSA-3wwx-pv8p-q78v、GHSA-pmjh-fq2x-6v4x、GHSA-r53p-7pc4-xj5r、GHSA-3xpg-4rpp-hhhm、GHSA-2jfj-6hjv-fm6j、GHSA-2gqq-gqf2-x968、GHSA-8436-99hf-9mmv、GHSA-rx4f-c7p8-82vq） |

**sharp**

| GHSA | 嚴重度 | 受影響 | 修復 |
|---|---|---|---|
| [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) | high | `<0.35.4` | 0.35.4 |
| [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | high（librsvg，CVE-2026-96889） | `<0.35.5` | 0.35.5 |

- direct `sharp@0.35.4` 只差 0.35.5；`miniflare@4.20260730.0` 內嵌的 `sharp@0.35.2` 兩筆都中。

- **可達性**：
  - `sharp`：repo 內只有 `scripts/generate-og-image.mjs` 用，是手動跑的離線腳本，輸入是 repo 自己的圖。**非 runtime**。
  - `miniflare`：tests 與 `wrangler pages dev` 用的 local 模擬（`tests/unit/migration-*.test.ts` 等 import `Miniflare`）。**非 prod**；CF Pages Functions 的 runtime 是 Cloudflare 自己的 workerd，不用這份 undici。本機 miniflare 會對 localhost 起 server，外連行為有限。
  - 結論：全屬 dev / test 風險；undici 的 DoS / cache 類 advisory 在本機測試情境下實際利用面小。「是否有任何測試真的對不受信任的遠端發 undici 請求」：**未證實**。
- 修法選項：
  1. `wrangler` -> **4.152.0**（latest，npm audit 說 wrangler 受影響到 4.148.0）。`npm view wrangler@4.152.0 dependencies` 顯示它 pin `miniflare@5.20261019.2-beta`，而該版 pin `undici@7.29.1`、`sharp@0.35.5`（`npm view` 確認）。**注意：wrangler 的依賴本身就是 miniflare 5 的 beta/alpha 通道**（4.131.0 已是 `5.20260910.0-alpha`），這是 Cloudflare 的發佈方式，不是我們選的。
  2. direct `miniflare@4.20260730.0` 是 npm `latest` tag（stable），但沒有新版，且內嵌舊 undici / sharp。要修需在 `overrides` 加 `"undici": "^7.29.1"`、`"sharp": "^0.35.5"`；或改用 `5.2026xxxx-beta`（不建議，beta）。**建議 override，並驗證 `npm run test:api` 與 migration unit test 仍綠**。
  3. direct `sharp` -> 0.35.5。

### 1.4 shell-quote（transitive via concurrently，dev）

- [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv)（CVE-2026-102422，critical，CVSS 8.1）：`quote()` 在 `{ comment }` token 後面遇到換行 token 會 command injection。受影響 `>=1.8.4 <1.11.0`，修復 **1.11.0**（`npm view shell-quote dist-tags` 目前 latest 1.12.0）。lockfile 為 1.9.0。
- 鏈：`concurrently@9.2.4 -> shell-quote@1.9.0`。npm audit 說 concurrently `9.2.3 - 9.2.4 || 10.0.0 - 10.0.5` 受影響；**9.2.5**（backport tag）與 10.0.6 為修復。
- **可達性**：只在 `npm run dev` 時 concurrently 解析本專案自己寫死的指令字串，不吃外部輸入；`quote()`（而非 `parse()`）concurrently 是否呼叫：**未證實**。判斷為低風險，但升級成本是 patch。
- 建議：`concurrently` -> **9.2.5**（同 major，修復版）。不要為此升 10。

### 1.5 compression / serve（direct dev）

- [GHSA-vc2v-76pw-4v95](https://github.com/advisories/GHSA-vc2v-76pw-4v95)（CVE-2026-87776，high 7.5）：`compression <1.8.2` 在 response 提前關閉時記憶體洩漏 DoS，修 **1.8.2**。
- 鏈：`serve@14.2.6 -> compression@1.8.1`。`serve` 14.2.6 已是 latest，沒有更新版。
- **可達性**：`serve` 在 `package.json` devDependencies，但 repo 內 `package.json` scripts、`.github/workflows`、`playwright.config.js` 都沒有呼叫（e2e 用 `vite preview`）。實際上疑似未使用。
- 建議：先 grep 確認無人用就**移除 `serve`**；否則加 `overrides.compression: ^1.8.2`。（移除屬行為變更，留給 /implement 確認。）

### 1.6 source-map-js（transitive，build/dev）

- [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)（CVE-2026-93749，high 7.5）：source-map section offsets 造成 event-loop DoS。`>=1.0.0 <1.2.2`，修 **1.2.2**（latest）。lockfile 1.2.1。
- 鏈：postcss（vite / tailwind 工具鏈）。**可達性**：只有 build 時處理受信任的 source map，非 runtime。
- 建議：`npm update source-map-js` 或 override `^1.2.2`；patch 級。

### 1.7 vitest / @vitest/mocker（direct dev）

| GHSA | 嚴重度 | 受影響 | 修復 |
|---|---|---|---|
| [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8)（CVE-2026-112949） | medium 4.7 | `@vitest/mocker >=2.1.0-beta.7 <4.1.12` | 4.1.12（或 5.0.3） |
| [GHSA-xp26-3454-mjgp](https://github.com/advisories/GHSA-xp26-3454-mjgp)（CVE-2026-112950） | medium 5.9 | `>=4.1.11 <4.1.12`；Windows 反斜線 | 4.1.12（或 5.0.3） |

- 僅 vitest dev server / 測試時；第二筆 Windows 限定。lockfile 為 4.1.11。
- 建議：`vitest`、`@vitest/runner`、`@vitest/snapshot` 一起升 **4.1.12**（`npm view vitest dist-tags` 的 `V4` = 4.1.12，`latest` 已是 5.0.5，見 3.3）。**注意要明確 pin 4.1.x，否則 `^4.1.10` 不會跳到 5，OK；但不要用 `npm install vitest@latest`。**

## 2. 一次修完的建議（patch / 同 major，供 /implement）

優先序：先 overrides + lockfile 內 patch，不動任何 major。

1. `overrides`：`dompurify ^3.4.17`；新增 `undici ^7.29.1`、`sharp ^0.35.5`、`source-map-js ^1.2.2`（必要時 `compression ^1.8.2`）。
2. direct：`vite ^8.3.5`、`wrangler ^4.152.0`、`sharp ^0.35.5`、`concurrently ^9.2.5`、`vitest`/`@vitest/runner`/`@vitest/snapshot ^4.1.12`。
3. 驗證：`npm ci` -> `npm audit`（剩餘項目應只剩 miniflare 內嵌版本，若 override 生效則清零）-> `npm run typecheck && npm run typecheck:functions && npm test && npm run test:api && npm run build`。記憶提醒：type check 用 `tsc --ignoreDeprecations` 驗真，避免 TS5101 短路假綠。

## 3. outdated 套件與升版風險

現況（lockfile 實裝）-> npm registry latest（`npm outdated` + `npm view <pkg> dist-tags`，已排除 beta/rc/next）。

### 3.1 可安全升（minor / patch）

| 套件 | 現況 | 目標 |
|---|---|---|
| react / react-dom | 19.3.0 | 19.3.1 |
| react-router-dom | 7.18.3 | 7.18.4 |
| react-day-picker | 10.0.1 | 10.0.2 |
| @sentry/react | 10.70.0 | 10.76.2（wanted；latest 是 11.9.0，見 3.2） |
| @sentry/vite-plugin | 5.4.0 | 5.4.1（latest 11.9.0 屬 major） |
| @playwright/test | 1.61.1 | 1.64.1（需 `npx playwright install`，記憶：本機瀏覽器版本要重裝） |
| vite / @vitejs/plugin-react | 8.3.0 / 6.1.1 | 8.3.5 / 6.1.2 |
| eslint / typescript-eslint | 10.8.0 / 8.65.0 | 10.13.0 / 8.72.0（`typescript-eslint@8.72.0` peer `typescript >=4.8.4 <6.1.0`，所以**不能搭 TS 7**） |
| axe-core | 4.12.1 | 4.14.0（新規則可能讓既有 a11y 測試新增紅燈，升後單獨跑 a11y 測試） |
| nodemailer / oidc-provider | 10.0.12 / 9.12.0 | 10.2.1 / 9.13.0（auth 相關，升後跑 OAuth 相關 test） |
| @cloudflare/workers-types | 5.20260910.1 | 5.20261023.1 |
| @googlemaps/js-api-loader / @types/google.maps | 2.1.1 / 3.66.2 | 2.1.3 / 3.66.7 |
| @testing-library/dom / react | 10.4.1 / 16.3.2 | 10.4.2 / 16.3.3 |
| fake-indexeddb / idb / globals | 6.2.5 / 8.0.3 / 17.12.0 | 6.2.6 / 8.0.4 / 17.13.0 |
| vitest 系列 | 4.1.11 | 4.1.12 |

這些我只確認了版本號（`npm outdated`），**沒有逐一讀 changelog**；semver 內的 minor 理論上不含 breaking，風險靠測試把關：標「未證實無 breaking」。

### 3.2 需獨立評估（major）

建議順序：A 風險低且無依賴 -> B -> C；每個獨立一張票 / 一個 PR。

| 套件 | 現況 -> latest | Breaking / 風險（來源） | 建議 |
|---|---|---|---|
| `@testing-library/jest-dom` | 6.9.1 -> 7.0.1 | `@testing-library/dom` 變為必要 peer、Node 最低 22（[release v7.0.0](https://github.com/testing-library/jest-dom/releases/tag/v7.0.0)）。本專案已有 `@testing-library/dom`，風險低 | 順序 1，可早做 |
| `concurrently` | 9.2.4 -> 10.0.6 | Node `<22` 不支援、ESM-only、預設 prefix 自動上色、移除 `--name-separator`（[v10.0.0](https://github.com/open-cli-tools/concurrently/releases/tag/v10.0.0)）。`package.json` 的 `dev` 用了 `-n` / `-c`，需實測。本機 Node 25.9，CI Node 版本**未檢查** | 順序 1；若不急，留 9.2.5（已修 shell-quote） |
| `vite-plugin-pwa` | 1.3.0 -> 2.0.0 | 官方 release note 只列「允許 `@vite-pwa/assets-generator ^2.0.0` 作為 peer」（[v2.0.0](https://github.com/vite-pwa/vite-plugin-pwa/releases/tag/v2.0.0)）；實質 breaking 看起來小，但本專案有 SW 與 `verify-sw` 腳本、PWA 快取行為有歷史雷，升後必跑 `npm run verify-sw` + build 驗產物 | 順序 2 |
| `dotenv` | 16.6.1 -> 18.0.9 | 跳兩個 major。`npm view dotenv@18.0.9 engines` = node >=12，我沒有取得 v17/v18 官方 release 原文（GitHub release tag 404；印象中 v17 起預設會在 stdout 印 log，但**未證實**）：**breaking 內容未證實**，升前必須讀 CHANGELOG.md（`https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md`）。dotenv 17 在記憶中有過「假紅」案例 | 順序 3，低價值，可不升 |
| `marked` | 17.0.6 -> 18.1.1 | 18.0.0：block token 尾端空白行被 trim、升 TypeScript 6（[v18.0.0](https://github.com/markedjs/marked/releases/tag/v18.0.0)）。會改變輸出 HTML，需看使用 marked 的畫面/快照測試 | 順序 2 |
| `jsdom` | 26.1.0 -> 29.1.1 | 我只讀到 29.0.0 的 release：Node 22.13+、CSSOM 整個重寫（`@acemir/cssom` / `cssstyle` 被取代）、media query 解析改用 css-tree，會影響依賴 `getComputedStyle` / CSS 的 DOM 測試（[29.0.0](https://github.com/jsdom/jsdom/releases/tag/29.0.0)）；27、28 的 release **未讀**。記憶：本機 DOM 測試本來就偶發紅燈，升版需拉開分析 | 順序 3，建議等 vitest 5 後再一起評估 |
| `@sentry/react` / `@sentry/vite-plugin` | 10.70 / 5.4 -> 11.9.0 | 11.0.0 breaking：span attribute / op 改名（`http.*`、`net.*`、middleware/handler op）、Node >=20.19、Safari 14 不支援、瀏覽器 session 改 `unhandled`、預設 `page` lifecycle、span streaming 成預設（[v11.0.0](https://github.com/getsentry/sentry-javascript/releases/tag/11.0.0)、[MIGRATION.md](https://github.com/getsentry/sentry-javascript/blob/develop/MIGRATION.md)）。**會改變 Sentry 上的指標與告警基準**；`@sentry/vite-plugin@11.9.0` 的 engines 為 Node `>=20.19.0 <22 || >=22.12.0 <23 || >=23.2.0`（npm registry）。需決定要不要接受 observability 斷層 | 順序 3；10.76.2 先升 |
| `vitest` | 4.1.12 -> 5.0.5 | 大量 breaking（[v5.0.0](https://github.com/vitest-dev/vitest/releases/tag/v5.0.0)）：預設 **clear mocks before each test**、非同步斷言沒 await 會失敗、`expect.poll` 逾時失敗、`toHaveTextContent` 變 strict、hoisted mock 在非 top-level 會 throw、不再往上找 config、`@vitest/runner` 被內嵌不再發佈（本專案 `package.json` 直接依賴 `@vitest/runner` 與 `@vitest/snapshot`，需移除/調整）、Node >=22.12、需 Vite >=6.4、inline projects 預設繼承 root config（本專案有 `vitest.config.api.mts` 與 `.test.ts` / `.test.tsx` 分 project 的慣例）。對本專案 DOM 測試與 mock 大宗的風險**高** | 順序 4（最後），獨立票，需跑全量並比對測試數 |
| `typescript` | 5.9.3 -> 7.0.2 | 7.x 為原生（Go）編譯器；`typescript-eslint@8.72.0` peer `typescript <6.1.0`，**與 TS 7 不相容**；專案已知有 TS5101 / `--ignoreDeprecations` 議題。`npm view typescript dist-tags`：latest 7.0.2。我**沒有取得 7.0 官方 release notes 原文**（GitHub tag 404），所以 breaking 清單未證實 | 順序 5 / 暫緩，等 typescript-eslint 支援；中間可考慮 6.0.x（未評估） |

### 3.3 不在 audit 但值得註記

- `wrangler` 現已依賴 miniflare 5 的 alpha/beta 通道（見 1.3），升 wrangler 4.152.0 的同時 `npm ls miniflare` 會同時存在 miniflare 4 與 5；`npm run test:api` 需確認用的是 direct 4.x。
- `npm audit` 對 miniflare / sharp / undici 提供的 `fixAvailable` 是降版到 `miniflare@4.20250508.2`，是**錯誤的建議**。

## 4. 來源索引（抓取日期皆 2026-10-23）

- GitHub Advisory Database：`https://github.com/advisories/<GHSA>`（本文所有 GHSA 皆以 `gh api /advisories/<GHSA>` 取原文）
- npm registry：`https://registry.npmjs.org/<pkg>`（`npm view <pkg> dist-tags / dependencies / peerDependencies / engines`）
- Vitest v5.0.0：https://github.com/vitest-dev/vitest/releases/tag/v5.0.0
- Sentry JS v11.0.0：https://github.com/getsentry/sentry-javascript/releases/tag/11.0.0 ；MIGRATION：https://github.com/getsentry/sentry-javascript/blob/develop/MIGRATION.md
- marked v18.0.0：https://github.com/markedjs/marked/releases/tag/v18.0.0
- concurrently v10.0.0：https://github.com/open-cli-tools/concurrently/releases/tag/v10.0.0
- jest-dom v7.0.0：https://github.com/testing-library/jest-dom/releases/tag/v7.0.0
- jsdom 29.0.0：https://github.com/jsdom/jsdom/releases/tag/29.0.0
- vite-plugin-pwa v2.0.0：https://github.com/vite-pwa/vite-plugin-pwa/releases/tag/v2.0.0
- dotenv CHANGELOG：https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md（只讀到 18.0.4 之後的條目，未讀 17 / 18.0.0）
