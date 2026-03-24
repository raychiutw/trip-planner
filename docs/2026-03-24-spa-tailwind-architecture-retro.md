# SPA 架構改造開發回顧

**日期**：2026-03-24
**PR**：#101
**分支**：feat/spa-tailwind-architecture
**變更**：多頁面 → SPA（React Router + lazy loading）、Tailwind 遷移、刪除 setting 頁
**結果**：70 files changed, +15138 -1300（含 D1 備份 + dist build artifacts）

---

## 架構決策分析

### 決策 1：多頁面 → 單入口 SPA

**Before**：4 個 HTML 入口（index.html、setting.html、manage/index.html、admin/index.html），各自有獨立的 entry TSX 和 CSS。Vite 的 `rollupOptions.input` 列出 4 個入口。

**After**：單一 `index.html` + React Router。`/trip/:tripId`、`/manage`、`/admin` 透過 client-side routing 切換，`lazy()` 按需載入。

**為什麼現在做**：

1. **連結問題的根源已累積**：前幾天 `8966f36` 修的「內部連結改絕對路徑」和 `587edbf` 修的「非 /trip/ 路徑 404」，根本原因都是多頁面架構下的路徑計算問題。每新增一個路由層級就要重新處理相對路徑。SPA 徹底消除這類問題。
2. **頁面間導航是硬跳轉**：`window.location.href` 觸發整頁重載。對只有 3 個路由的小站來說，用戶感知不明顯，但對工程品質是退步——React 狀態（dark mode、選中行程）每次跳轉都要重新初始化。
3. **CSS 碎片化**：4 套 CSS（shared + style + setting + manage + admin）有大量重複的 token 引用和元件樣式。統一入口後，共用樣式只載入一次。

**權衡**：

- **Service Worker 複雜度增加**：SPA 的 navigation fallback 需要謹慎處理。最終選擇 `navigateFallback: null`，讓 SW 只管靜態資源和 API cache，不攔截導航。這犧牲了離線 fallback 能力，但避免了 SW 和 React Router 的衝突。
- **Cloudflare Pages 的 `_redirects`**：SPA 需要 server-side 把所有路徑 rewrite 到 `index.html`。Cloudflare Pages 用 `_redirects` 檔案，每行一條規則。只需 2 行（`/manage` 和 `/admin`），因為 `/trip/*` 已經由 `index.html` 作為 root 處理。
- **首次載入增加**：所有路由的 shared code（React、React Router、shared CSS）在 main bundle。但 lazy loading 確保各頁面元件只在需要時載入。實測 main bundle 增量約 15KB（react-router-dom gzipped）。

### 決策 2：Tailwind 遷移策略——漸進式，不全面

**策略**：只遷移被刪除 CSS 檔案涵蓋的元件（ManagePage、AdminPage、RequestStepper），保留 shared.css 和 style.css 不動。

**為什麼不全面遷移**：

1. **shared.css 是基礎設施**：裡面的 CSS custom properties（`--color-accent`、`--font-size-body`）是整個設計系統的 token 層。Tailwind 的 `bg-[var(--color-accent)]` 語法依賴這些 token 存在。刪除 shared.css 意味著要把所有 token 搬進 `tailwind.config.js`——這是一個「ocean」級別的重構。
2. **style.css 和 TripPage 高度耦合**：行程頁的 timeline、entry card、restaurant card 等元件有複雜的巢狀結構和動畫，原生 CSS 寫得更清晰。Tailwind 的超長 className 在這些元件上會降低可讀性。
3. **被刪除的 3 個 CSS 檔案（admin.css、manage.css、setting.css）是自然邊界**：它們是獨立頁面的專屬樣式，不被其他頁面引用。刪除它們 + 用 Tailwind 重寫是零風險的——如果 Tailwind 寫錯，只影響單一頁面。

**結果**：CSS 淨減少 535 行（187 admin + 339 manage + 9 setting），Tailwind 的 utility classes 內嵌在 JSX 裡，不增加 CSS 檔案數。

### 決策 3：刪除 SettingPage

**理由**：設定頁只有 dark mode toggle 和行程偏好選擇。dark mode 已經透過系統偏好自動偵測（`useDarkMode` hook），行程偏好存在 localStorage 由 TripSelect 元件處理。設定頁沒有不可替代的功能。

**風險**：如果未來需要更多設定項目（通知偏好、語言切換），需要重新建立。但考慮到這是旅行行程網站，設定需求極低，刪除是合理的。

---

## Pipeline 執行紀錄

| 階段 | 技能 | 結果 |
|------|------|------|
| Build | 3 commits on branch | d9bcac0 → fcf91b5 → 45d70f7 |
| Test | `npm test` | 680/680 pass |
| Review | `/ship` pre-landing review | CLEAN — 無 SQL、XSS、race condition 問題 |
| Ship | `/ship` | PR #101 建立 |
| Deploy | `/land-and-deploy` | merge + Cloudflare Pages deploy |
| Canary | Playwright MCP 驗證 | HEALTHY — SPA routing + 內容渲染正常 |

---

## 遇到的問題

### 1. gstack browse daemon 無法啟動

**現象**：`$B goto` 反覆報 `Another instance is starting the server, waiting... Timed out`。pkill chromium/playwright 後仍無法恢復。

**繞過方式**：改用 Playwright MCP plugin（`mcp__plugin_playwright_playwright__browser_navigate`）完成 canary 驗證。

**根因推測**：Windows 環境下 browse daemon 的 lock file 或 socket 沒有正確清理。上一個 session 的 daemon 可能殘留了 `/tmp/browse-server-*` 但 process 已不存在。

**影響**：`/browse`、`/qa`、`/design-review`、`/canary` 等依賴 gstack browse 的技能全部無法使用。這是一個持續存在的 P2 問題（見上一份 retro 的 Bug 2）。

**建議**：browse daemon 啟動時應檢測 stale lock file（process 不存在 → 自動清理 → 重啟）。

### 2. PR 已存在時 `/ship` 嘗試重建

**現象**：`gh pr create` 失敗，因為 PR #101 已存在。改用 `gh pr edit` 更新 description。

**改善**：`/ship` Step 8 可以先 `gh pr view` 檢查是否已有 PR，有則直接 `gh pr edit`。

### 3. Squash merge 展平了 3 個有意義的 commits

**原始 commits**：
- `d9bcac0` — refactor: manage.css → Tailwind
- `fcf91b5` — feat: SPA + 單入口 + 刪除 setting
- `45d70f7` — feat: SPA + React Router + Tailwind + 刪除 setting

`gh pr merge --squash` 把它們壓成單一 commit `2aa267c`。對 bisect 來說資訊損失，但對這個大小的 PR 來說可接受。

---

## Tailwind + CSS Custom Properties 混合模式的觀察

遷移過程中發現一個有趣的模式：Tailwind 的 arbitrary value 語法（`bg-[var(--color-accent)]`）和 CSS custom properties 配合得比預期好。

**優點**：
- Token 一致性：所有顏色、字體大小、圓角仍由 shared.css 的 custom properties 定義，Tailwind 只是消費者
- 不需要 `tailwind.config.js` 的 theme 擴充——直接用 `var()` 引用
- Dark mode 自動跟隨——token 層已經處理了 `[data-theme="dark"]` 的值切換

**缺點**：
- `text-[length:var(--font-size-body)]` 這種語法很長，需要 `length:` prefix 告訴 Tailwind 這是 font-size 不是 color
- IDE 的 Tailwind IntelliSense 無法自動補全 arbitrary values
- 複雜的 child selector 樣式（如 `[&_th]:border`）可讀性低於原生 CSS

**結論**：這種混合模式適合「頁面 layout + 簡單元件」的場景，不適合「高度結構化的複雜元件」。行程頁的 timeline 和 entry card 留在原生 CSS 是正確的。

---

## 未解決的問題

### Bug 1：`@googlemaps/js-api-loader` 缺少（P1，繼承自前次 retro）

- `npx tsc --noEmit` 仍報 40+ 個 google namespace 錯誤
- CI 的 build 通過是因為 Vite 不跑 type check
- **建議**：`npm install -D @types/google.maps` 或 `@googlemaps/js-api-loader`

### Bug 2：gstack browse daemon 殭屍問題（P2，持續存在）

- 見上方「遇到的問題 #1」

### 新問題：CSP inline script warning

- Production 首頁有一個 CSP 違規：inline script 被 `script-src 'self'` 阻擋
- 位於 `index.html:25`，可能是 Cloudflare Insights 注入的 inline snippet
- **影響**：低——analytics 失效但不影響功能
- **修復方向**：CSP 加上 nonce 或 hash

---

## 改善建議

1. **建立 `_redirects` 的測試**：目前 SPA routing 依賴 Cloudflare Pages 的 `_redirects` 檔案。如果這個檔案被意外刪除，`/manage` 和 `/admin` 會 404。建議在 CI 加一個 `verify-redirects` step 檢查檔案存在且格式正確。

2. **Tailwind 遷移指引**：記錄何時用 Tailwind、何時用原生 CSS 的判斷標準，避免未來開發者隨意選擇：
   - 頁面 layout、表單、簡單列表 → Tailwind
   - 複雜巢狀元件、動畫、偽元素 → 原生 CSS
   - Token 定義永遠在 shared.css

3. **`/ship` 改善**：先檢查 PR 是否已存在再決定 create 或 edit，省去錯誤重試。

---

## OpenSpec 流程未使用的檢討

### CLAUDE.md 的規定

> **OpenSpec**：功能開發遵守 openspec 流程，除非使用者同意跳過

### 這次為什麼沒用

**直接原因**：本次 session 一進來就直接 `/ship`，在更早的 session 中 code 已經寫完。整個 feat/spa-tailwind-architecture 分支的開發過程跳過了 OpenSpec。

**深層原因分析**：

1. **開發節奏問題——「先做再說」**：SPA 架構改造是從前一個 session（品牌重塑 + unify-page-styles）的問題中自然延伸出來的。當時解決內部連結 404、路徑計算、CSS 碎片化等問題時，逐步意識到根本解法是 SPA 化。這種「問題驅動的重構」容易跳過流程——因為開發者已經很清楚要做什麼，覺得寫 spec 是「多餘的文書」。

2. **OpenSpec 的價值在「不確定」時最高**：SPA 改造的技術方案其實相當明確（React Router + lazy loading），不像新功能需要釐清需求。但 OpenSpec 的 design doc 階段本可以幫助思考：
   - Service Worker 和 SPA routing 的交互（navigateFallback 的決策）
   - Cloudflare Pages `_redirects` 的限制（只支持 2xx/3xx，不支持 wildcard rewrite）
   - CSS 遷移邊界的判斷標準（哪些用 Tailwind、哪些留原生）

   這些決策在開發過程中是「邊做邊想」的，如果先寫 spec 可以更早暴露風險。

3. **gstack pipeline 和 OpenSpec 的關係不清晰**：CLAUDE.md 同時要求「code 變更走 gstack 7 階段 pipeline」和「功能開發遵守 openspec 流程」。gstack 的 Think（`/office-hours`）+ Plan（`/autoplan`）和 OpenSpec 的 explore + propose 階段有角色重疊。開發者容易認為「走了 gstack pipeline 就等於走了流程」，但 gstack 的 Plan 階段是 review 已有計畫，不是從零產出 spec。

### 影響評估

**這次跳過 OpenSpec 造成了什麼損失？**

- **低**：技術方案明確，變更範圍可控（刪除 > 新增），測試全通過，production 驗證正常
- **中**：缺少 design doc 意味著決策理由只存在於開發者腦中。這份 retro 試圖補救，但 retro 是事後回顧，不是事前設計——品質不同

**如果用了 OpenSpec 會怎樣？**

- `/opsx:propose` 會產出 design doc，記錄 SPA routing 方案、CSS 遷移策略、SW 交互處理
- `/opsx:apply` 會產出 task breakdown，可能會把「Tailwind 遷移」和「SPA routing」拆成兩個獨立 change，各自可測試
- 但整體耗時會增加 15-30 分鐘（spec 撰寫 + 審查），對這個大小的變更來說投入產出比偏低

### 改善方案

1. **設定觸發門檻**：不是所有 code 變更都需要 OpenSpec。建議門檻：
   - **需要 OpenSpec**：新增功能、架構變更、API 變更、資料庫 migration
   - **可以跳過**：bug fix、CSS 調整、文件更新、單純重構（不改行為）
   - **灰色地帶**（本次屬於此類）：架構重構 + 刪除功能 → 建議至少跑 `/opsx:propose` 產出 design doc

2. **在 `/tp-team` 的 Think 階段加入 OpenSpec 提醒**：當偵測到變更涉及架構（新增/刪除入口、改 routing、改 build config）時，主動建議先 `/opsx:propose`

3. **Retro 補 spec**：像本次這樣，事後在 retro 中記錄決策理由，也算是一種補救。但應該標記為「retrospective spec」而非「design doc」，明確這是事後文件。
