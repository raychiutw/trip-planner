## Why

SPA 架構改造（PR #101）後，ManagePage 和 AdminPage 的 Tailwind inline classes 因 CSS Layer 優先級問題全部失效，導致 22 個 PR 的修復循環。最終被迫退回原版 CSS class names，shared.css 膨脹至 1226 行（包含 token + 全域元件 + manage 樣式 + admin 樣式），成為「技術上是 SPA + React Router，但樣式上是三套 CSS 並存的 Frankenstein」。

採用 AB Test Blue-Green 策略：新建 tokens.css + 所有頁面的 V2 元件（全 Tailwind inline），新舊並行驗證一致後切換，最終刪除舊 CSS。舊的一個字都不動。

## What Changes

- 新建 `css/tokens.css`（~660 行）：從 shared.css 複製 @theme token 定義 + 6 主題深淺模式切換 + @keyframes + Tailwind imports
- 新建 V2 元件：RequestStepperV2、ToastV2、AdminPageV2、ManagePageV2、TripPageV2（含 20+ 子元件 V2 版本）
- 修改 `src/entries/main.tsx`：加入 V1/V2 路由切換邏輯（`?v2=1` / `?v1=1` / localStorage）
- Phase 2 清理：刪除 shared.css、style.css、map.css，rename V2 → 原名
- SettingPage 已計畫廢除，不需遷移

## Capabilities

### New Capabilities
- `tailwind-tokens`: 獨立的 tokens.css 檔案，包含所有 CSS custom properties + Tailwind imports + 主題切換，V2 元件的樣式基礎
- `v2-routing`: main.tsx 的 V1/V2 路由切換機制（query string + localStorage），支援 `?v2=1` 啟用新版、`?v1=1` 強制回退

### Modified Capabilities
（無既有 spec 的需求層級變更，此次僅為樣式實作方式遷移）

## Impact

### 新增檔案
- `css/tokens.css` — V2 元件的樣式基礎
- `src/pages/ManagePageV2.tsx` — 全 Tailwind 版 ManagePage
- `src/pages/AdminPageV2.tsx` — 全 Tailwind 版 AdminPage
- `src/pages/TripPageV2.tsx` — 全 Tailwind 版 TripPage + 20+ 子元件 V2
- `src/components/shared/RequestStepperV2.tsx` — 全 Tailwind 版 RequestStepper
- `src/components/shared/ToastV2.tsx` — 全 Tailwind 版 Toast

### 修改檔案
- `src/entries/main.tsx` — V1/V2 路由切換邏輯（約 +10 行）

### 刪除檔案（Phase 2 清理後）
- `css/shared.css`（1226 行）
- `css/style.css`（1017 行）
- `css/map.css`
- 所有 V1 版頁面元件（被 V2 rename 取代）

### 不影響
- D1 schema / API 端點
- hooks（useApi、useDarkMode 等）— 純邏輯無 CSS 依賴
- Icon.tsx、TriplineLogo.tsx — 純 SVG 直接沿用
- Cloudflare Access + SPA routing 機制
