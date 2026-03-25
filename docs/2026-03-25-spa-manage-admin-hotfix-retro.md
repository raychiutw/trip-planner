# SPA Manage/Admin 頁面修復回顧

**日期**：2026-03-25
**PR**：#102 ~ #123（共 22 個 PR）
**問題**：SPA 改造（PR #101）後 ManagePage 和 AdminPage 版面壞掉、無法打開

---

## 時間線

| 時間（台北） | PR | 問題 | 修法 |
|------|-----|------|------|
| 03/24 18:00 | #101 | SPA 架構 merge + deploy | — |
| 03/24 18:16 | #102 | 手機版 Logo | 新增 32px 三波紋 mobile logo |
| 03/24 21:22 | #103 | trip_docs API 權限 | GET 移除認證檢查 |
| 03/24 21:40 | #104 | QuickPanel 橫線（誤解需求）| section A/B divider — **錯誤修改** |
| 03/24 21:47 | #105 | 還原 #104 + drag handle | 加回頂部短線 |
| 03/24 22:13 | #106 | handle 調亮 | foreground + opacity 0.35 |
| 03/24 22:19 | #107 | dark mode handle | dark opacity 0.6 |
| 03/24 22:40 | #108 | handle 改用 color-muted | 移除 opacity hack |
| 03/24 22:55 | #109 | handle 加寬 40px | 寬度調整 |
| 03/24 23:05 | #110 | handle 改用 border-top | background-clip 問題修復 |
| 03/24 23:12 | #111 | **rebuild dist** | 發現 dist/ 未隨源碼更新 |
| 03/24 23:35 | #112 | Logo CSS 移至 shared.css | Manage/Admin 沒載入 style.css |
| 03/24 23:45 | #113 | edit FAB 改用 Link | Cloudflare Access 攔截修復 |
| 03/25 06:30 | #114 | page-layout 移除（**錯誤**）| 後來發現不該移除 |
| 03/25 06:34 | #115 | auth redirect | 401/403 自動觸發 Access 登入 |
| 03/25 06:49 | #116 | content padding（**不完整**）| Tailwind 沒生效 |
| 03/25 06:56 | #117 | 恢復 page-layout | 修復 #114 的錯誤 |
| 03/25 07:05 | #118 | **完整修復** | CSS class 恢復 + manage.css 全部樣式 |
| 03/25 07:20 | #119 | 桌機版置中 | `:has(.info-panel)` 限定 padding-right |
| 03/25 08:10 | #120 | AdminPage CSS 恢復 | admin.css 全部樣式 |
| 03/25 08:50 | #121 | _redirects trailing slash | `/admin/` `/manage/` |
| 03/25 09:00 | #122 | **移除 dist/ 從 git** | 根本原因：chunk hash 衝突 |
| 03/25 09:25 | #123 | admin/manage index.html | build 後複製 SPA 入口 |

---

## 根本原因分析

### 1. dist/ 被 commit 到 git（最嚴重）

**現象**：production 上的 JS chunk hash 跟源碼不一致，瀏覽器報 MIME type error。

**根因**：Cloudflare Pages 的 build command 是 `npm run build`，會自己產生 dist/。我們同時 commit dist/ 到 git，兩邊產生不同的 chunk hash。Cloudflare Pages 的 build 優先，但 CDN edge cache 可能混用新舊版。

**修復**：dist/ 加入 .gitignore，從 git 移除。以後只 commit 源碼。

**教訓**：在做架構變更前，先確認 CI/CD pipeline 的 build 機制。如果平台自己 build，不要 commit build output。

### 2. Tailwind v4 CSS Layer 優先級（影響最廣）

**現象**：ManagePage/AdminPage 的所有 Tailwind inline classes（font-size、padding、margin）全部不生效，fallback 到預設值。

**根因**：`shared.css` 用 `@import "tailwindcss/utilities" layer(utilities)` 載入 Tailwind。CSS `layer()` 的優先級低於非 layer 的 CSS 規則。shared.css 裡的 `.request-item`、`.sticky-nav` 等非 layer 規則覆蓋了 Tailwind utilities。

**修復**：放棄 Tailwind inline classes，恢復原版 CSS class names。把 manage.css 和 admin.css 的樣式全部加到 shared.css。

**教訓**：
- Tailwind v4 的 CSS Layer 架構跟原生 CSS 混用時有優先級陷阱
- `text-[var(--font-size-*)]` 在 Tailwind v4 會被解析為顏色而非字體大小，需要 `text-[length:var(--font-size-*)]`
- 遷移 CSS 框架時，必須在本機用 computed styles 驗證，不能只看「是否有報錯」

### 3. Cloudflare Access + SPA routing 衝突

**現象**：`/manage` 和 `/admin` 打不開，被 redirect 到行程頁。

**根因**：
- SPA 的 `<a href="/manage/">` 觸發 full page reload → Cloudflare Access 攔截 → 302 redirect → SPA catch-all 路由 → 導回行程頁
- `_redirects` rewrite 被 Cloudflare Access 攔截優先級覆蓋
- 舊版 `admin/index.html` 在 Pages CDN 快取，新版 build 沒有這個檔案

**修復**：
- edit FAB 改用 React Router `<Link>`（client-side navigation，不經 server）
- ManagePage API 401/403 時 `window.location.replace()` 觸發 Access 登入
- build script 自動複製 `index.html` 到 `dist/admin/` 和 `dist/manage/`

**教訓**：
- SPA + Cloudflare Access 的認證路徑需要特殊處理
- 不能依賴 `_redirects` rewrite，因為 Access 在 rewrite 之前攔截
- 需要在每個受保護路徑放實體的 `index.html` 檔案

### 4. style.css 的 TripPage 專用規則污染其他頁面

**現象**：
- ManagePage 的行程選擇器不居中（`.sticky-nav > :not(.destination-art) { position: relative }` 覆蓋了 `position: absolute`）
- 桌機版內容偏左（`.page-layout { padding-right }` 為 InfoPanel 預留空間，但 ManagePage 沒有 InfoPanel）

**修復**：
- `.sticky-nav > :not(.destination-art):not(.manage-trip-select--center)` 排除 select
- `.page-layout:has(.info-panel)` 限定 padding-right

**教訓**：SPA 共用 CSS 時，TripPage 專用的選擇器會影響其他頁面。新增全域 CSS 規則時要考慮所有頁面。

---

## 流程反省

### 做錯的

1. **盲改盲 deploy**：前 10 個 PR 是「改 → deploy → 用戶報錯 → 再改」的循環。應該先在本機完整驗證。
2. **沒有舊版對照**：直到用戶要求才用 git worktree 開舊版比對。應該在改之前就先截圖記錄舊版狀態。
3. **Tailwind 遷移沒驗證 computed styles**：只看 class 名有沒有寫對，沒用 DevTools 確認 computed 值。
4. **假設 dist/ 是靜態部署**：沒有先確認 Cloudflare Pages 的 build mechanism，錯誤地 commit dist/。
5. **沒跑 OpenSpec 流程**：SPA 架構改造是重大變更，應該先 propose + review。

### 做對的

1. **最終用 mock API + 舊版並排比對**：這是最可靠的驗證方式。
2. **記錄所有 computed styles**：用 Playwright evaluate 擷取新舊版的每個元素 fontSize、padding、margin 等值。
3. **找到 CSS Layer 優先級根因**：不是逐個修 Tailwind class，而是理解為什麼整體不生效。

### 改善行動

1. **所有 CSS/UI 變更必須本機 mock + 舊版比對後才 deploy**
2. **不再 commit dist/**（已加 .gitignore）
3. **SPA 新增路由時，build script 自動複製 index.html**
4. **Tailwind v4 與原生 CSS 混用時，不在有非 layer CSS 的元素上用 Tailwind utilities**
