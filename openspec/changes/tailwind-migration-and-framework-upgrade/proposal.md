## Why

專案目前使用 1,951 行手寫原生 CSS，分散在 6 個檔案中。隨著元件數量增長（26 個），CSS 與 JSX 之間的上下文切換成本增加，新增樣式時需在兩個檔案間來回。Tailwind CSS v4 的 CSS-first 設計、零配置內容偵測、以及原生 CSS Custom Properties 支援，讓它能與現有的多主題系統共存。

同時，多個核心依賴有可用升級：Vitest 3→4（相容 Vite 8）、React Compiler v1.0（自動 memoization）、lightningcss（Vite 8 內建）。一併處理可避免多次 breaking change 風險。

## What Changes

### Part A：Tailwind CSS v4 遷移

- 安裝 `tailwindcss` + `@tailwindcss/vite`（v4 最新穩定版）
- 建立 `src/app.css` 作為 Tailwind 入口，使用 `@import "tailwindcss"` + `@theme` 映射現有 CSS Custom Properties
- 保留 `css/shared.css` 中的 `:root` token 與 4 套主題（sun/sky/zen/print）× light/dark 色彩變數定義
- 逐步將 6 個 CSS 檔（shared/style/setting/manage/admin/edit）中的元件樣式遷移至 JSX 內 Tailwind utility classes
- 保留無法用 utility 表達的樣式（`clip-path`、`color-mix`、複雜 pseudo-element、`@media print`、`prefers-reduced-motion`）於精簡後的 CSS 檔中
- 26 個 React 元件逐一重構 className

### Part B：技術框架升級

- Vite 8.0.0 → 8.0.1
- Vitest 3.0.0 → 4.x（最新穩定版）
- 啟用 React Compiler v1.0（`babel-plugin-react-compiler`）
- tsconfig.json：`target` ES2020→ES2022、新增 `noUncheckedIndexedAccess`、`verbatimModuleSyntax`

## Capabilities

### New Capabilities

- `tailwind-css-v4`：所有元件使用 Tailwind v4 utility classes，CSS-first 主題配置
- `react-compiler`：React Compiler v1.0 自動 memoization，無需手動 memo/useCallback/useMemo

### Modified Capabilities

- `multi-theme-system`：主題 token 保留在 CSS Custom Properties，透過 Tailwind `@theme` 橋接為 utility class
- `print-mode`：列印樣式保留獨立 CSS 規則（`@media print` + `.print-mode`），不遷移至 utility
- `css-architecture`：從 6 個完整 CSS 檔瘦身為：1 個 Tailwind 入口 + 1 個主題/token 檔 + 1 個不可遷移規則檔

## Impact

### 新增檔案
- `src/app.css`：Tailwind 入口 + `@theme` 映射 + `@custom-variant`

### 大幅修改
- `vite.config.ts`：新增 `@tailwindcss/vite` plugin
- `package.json`：新增 tailwindcss 依賴 + 升級 vitest + 新增 react-compiler
- `tsconfig.json`：target/strictness 升級
- `css/shared.css`：保留 `:root` + 主題變數，移除元件樣式
- `css/style.css`：僅保留不可遷移規則（print mode、clip-path、color-mix、backdrop-filter 組合）
- `css/setting.css`、`css/manage.css`、`css/admin.css`、`css/edit.css`：大幅瘦身或移除
- `src/components/trip/*`（24 檔）：className 重構為 Tailwind utility
- `src/components/shared/*`（3 檔）：className 重構
- `src/pages/*`（4 檔）：可能需調整 className

### 不異動
- D1 schema、API 端點
- `functions/api/*`
- `js/`（舊版 vanilla JS）
- 主題切換邏輯（`useDarkMode` hook）
- 列印模式邏輯（`usePrintMode` hook）

### 測試影響
- `css-hig.test.js`：需更新以適應 Tailwind class 命名
- unit tests：React 元件 className 斷言需更新
- e2e tests：若使用 CSS class selector 需檢查
