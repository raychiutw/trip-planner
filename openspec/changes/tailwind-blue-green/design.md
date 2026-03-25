## Context

SPA 架構改造後，shared.css（1226 行）成為單體 CSS，包含 token 定義 + 全域元件 + 各頁面樣式。Tailwind v4 的 `@theme` block 在 shared.css 內正確生成 utilities，但非 layer 的 CSS class（`.request-item` 等）優先級高於 Tailwind utilities，導致 inline Tailwind 失效。

目前樣式架構：
- `shared.css`（1226 行）：tokens + themes + base + manage + admin 樣式
- `style.css`（1017 行）：TripPage 專用
- `map.css`：地圖元件樣式
- 所有元件使用語意化 CSS class names，零 Tailwind inline

## Goals / Non-Goals

**Goals:**

- 新建 tokens.css（~660 行），獨立的 token + theme + Tailwind imports，無 Layer 衝突
- 所有頁面元件建立 V2 版本（全 Tailwind inline），功能邏輯不變
- V1/V2 透過路由切換並行，`?v2=1` 啟用新版，`?v1=1` 強制回退
- 驗證視覺一致後切換預設，清理舊 CSS + rename V2 → 原名
- 最終狀態：只有 tokens.css + Tailwind inline，新頁面零 CSS 檔案依賴

**Non-Goals:**

- 不建 Component library / Storybook
- 不遷移 SettingPage（計畫廢除）
- 不重構 TripPage 子元件結構（只改樣式）
- 不改 D1 schema / API 端點

## Decisions

### D1：Blue-Green 策略 — 舊的一個字都不動

**選擇**：新建全套 V2 元件 + tokens.css，新舊並行，驗證後切換。

**放棄方案**：
- Layer 修正 + 逐頁遷移（碰 shared.css → 影響行程頁，22 PR 教訓）
- Tailwind `!important`（技術債，不解決根因）

**理由**：22 個 hotfix PR 證明碰舊 CSS 就是風險。Blue-Green 零風險，CC 開發成本可忽略。

### D2：tokens.css 包含 @theme + 主題切換（~660 行）

**選擇**：tokens.css 包含 shared.css 的 @theme block（162 行）+ 6 主題 × 深/淺模式切換（504 行）+ @keyframes + 全域 reset。

**放棄方案**：只複製 @theme block（~120 行）

**理由**：少了主題切換，V2 元件在非預設主題下顏色全部錯誤。/autoplan 審查時發現此估算錯誤並已修正。

### D3：main.tsx 路由層切換

**選擇**：在 main.tsx 用 query string + localStorage 決定載入 V1 或 V2 的 `React.lazy` import。

```tsx
const useV2 = !forceV1 && (forceV2 || storedV2);
const ManagePage = lazy(() => useV2 ? import('../pages/ManagePageV2') : import('../pages/ManagePage'));
```

**理由**：路由層切換讓 V1/V2 的 lazy import 在 tree-shaking 時完全分開，bundle 不會同時包含兩套。

### D4：由小到大逐功能遷移

**選擇**：RequestStepper（69 行）→ Toast（40 行）→ AdminPage（324 行）→ ManagePage（491 行）→ TripPage（1189 行 + 20+ 子元件）

**理由**：小元件先驗證 tokens.css + Tailwind 正常運作，再做大頁面。每個功能單元走完「新建 → 驗證 → deploy → 切換 → 清理 → rename」完整循環。

### D5：V2 開發規範

- `import '@/../css/tokens.css'`（Vite alias `@` = `src/`）
- 所有樣式用 Tailwind inline classes
- Token 引用：`bg-[var(--color-secondary)]`、`text-[length:var(--font-size-body)]`（v4 需 `length:` prefix）
- 所有 `aria-*`、`role`、`tabIndex` 屬性從 V1 完整複製
- 不引用任何舊版 CSS class

## Risks / Trade-offs

- **tokens.css Layer 衝突未解決** → Step 0.1 驗證卡點：Playwright computed styles 確認 Tailwind 生效，失敗則整個方案重新評估
- **V2 元件視覺不一致** → 每個功能單元 Step B 用 Playwright 比對 7 個 computed style 屬性（fontSize, padding, margin, color, backgroundColor, transition, opacity）
- **過渡期 bundle 較大** → React.lazy code splitting 隔離，使用者只載入 V1 或 V2
- **TripPage 20+ 子元件遷移複雜** → 逐一確認清單，由小到大排序
- **SW 快取舊版 CSS** → Workbox 自動更新 precache manifest

## Migration Plan

### Phase 0：基礎建設
1. 新建 tokens.css（從 shared.css 複製 tokens + themes）
2. **驗證卡點**：Playwright 確認 Tailwind 無 Layer 衝突
3. main.tsx 加入 V1/V2 路由切換

### Phase 1：逐功能遷移（每個走 Step A-G 完整循環）
- #1 RequestStepperV2
- #1.5 ToastV2
- #2 AdminPageV2
- #3 ManagePageV2
- #4 TripPageV2（+ 20+ 子元件 V2）

每個功能單元：新建 V2 → mock 驗證 → deploy（預設舊版）→ `?v2=1` 測試 → 切換預設 → 清理舊版 → rename → 驗證

### Phase 2：最終清理
1. 刪除 shared.css、style.css、map.css
2. 移除 main.tsx 切換邏輯
3. 跑全部 E2E 回歸

### 回滾策略
- 任何 V2 元件可直接刪除，舊版不受影響
- `?v1=1` 強制回退已切換的元件
- Phase 2 前所有舊 CSS 檔案仍存在

### D6：Cutover 部署規則（Admin/Manage 實戰經驗）

**選擇**：mainV2 用 BrowserRouter + main.tsx dynamic import，不再依賴 v2.html + HashRouter。

**放棄方案**：v2.html 獨立入口 + HashRouter（被 Cloudflare Pages Pretty URLs 的 308 redirect 破壞）

**理由**：Cloudflare Pages Pretty URLs 把 `/v2.html` 308 redirect 到 `/v2`，導致 v2.html 永遠無法被正確載入。改用 BrowserRouter + dynamic import 完全迴避此問題。

**Cutover Checklist（每個頁面必做）**：
1. `main.tsx`：路徑加到 `V2_CUTOVER_PATHS` → `import('./mainV2')`
2. `mainV2.tsx`：BrowserRouter + 加 trailing slash route（`/manage/`）
3. `mainV1.tsx`：移除該路徑 route + import
4. V1 頁面的跨頁連結：`<Link>` 改 `<a href="/path/">`（full page nav + trailing slash）
5. `_redirects`：加 `/path /path/ 301`
6. Build script：確保 `path/index.html` 存在

## Open Questions

1. **TripPage V2 的巢狀元件**：timeline/entry card 用 Tailwind 可讀性是否可接受？實作時視情況決定。
2. ~~**Service Worker 快取**：切換 V2 後 SW precache manifest 會自動更新（Workbox 處理），需實際驗證。~~ 已驗證，Workbox 正確處理。
3. ~~**Cloudflare Pages Pretty URLs**~~：已解決，見 D6。
