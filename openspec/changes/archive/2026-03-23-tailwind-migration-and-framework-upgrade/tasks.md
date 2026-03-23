## 1. 技術框架升級（framework-upgrade）

- [ ] 1.1 執行 `npm update vite` 升級 Vite 8.0.0 → 8.0.1
- [ ] 1.2 執行 `npm install vitest@latest -D` 升級 Vitest 3 → 4.x
- [ ] 1.3 執行 `npm install babel-plugin-react-compiler -D` 安裝 React Compiler
- [ ] 1.4 修改 `vite.config.ts`：在 `react()` plugin 中加入 `babel: { plugins: ['babel-plugin-react-compiler'] }`
- [ ] 1.5 修改 `tsconfig.json`：`target` → `ES2022`、新增 `noUncheckedIndexedAccess: true`、新增 `verbatimModuleSyntax: true`
- [ ] 1.6 修正 `verbatimModuleSyntax` 導致的所有 `import type` 錯誤（全專案搜尋 type-only import 並加 `type` 關鍵字）
- [ ] 1.7 修正 `noUncheckedIndexedAccess` 導致的型別錯誤（需加 nullish check 的地方）
- [ ] 1.8 執行 `npx tsc --noEmit` 確認零 TypeScript 錯誤
- [ ] 1.9 執行 `npm test` 確認所有測試通過

## 2. Tailwind CSS v4 安裝與配置（tailwind-setup）

- [ ] 2.1 執行 `npm install tailwindcss @tailwindcss/vite` 安裝 Tailwind v4
- [ ] 2.2 修改 `vite.config.ts`：import 並加入 `tailwindcss()` plugin（放在 `react()` 之後）
- [ ] 2.3 建立 `src/app.css`：`@import "tailwindcss"` + `@import "../css/shared.css" layer(base)` + `@theme` 映射所有 CSS Custom Properties + `@custom-variant dark`
- [ ] 2.4 在各入口 `src/entries/main.tsx`、`setting.tsx`、`manage.tsx`、`admin.tsx` 中 `import '../app.css'`
- [ ] 2.5 從 4 個 HTML 入口（`index.html`、`setting.html`、`manage/index.html`、`admin/index.html`）移除原生 CSS `<link>` 標籤（改由 JS import 管理）
- [ ] 2.6 執行 `npm run build` 確認 Tailwind 正確產生 utility class，頁面樣式正常
- [ ] 2.7 驗證主題切換（sun/sky/zen × light/dark）utility class 值正確跟隨 CSS Custom Properties

## 3. shared.css 精簡（shared-css-slim）

- [ ] 3.1 從 `css/shared.css` 中識別並標記所有元件樣式（非 token/theme/reset 的規則）
- [ ] 3.2 將 `.trip-btn`、`.nav-back-btn`、`.nav-close-btn`、`.svg-icon` 等共用元件樣式遷移至使用這些 class 的 React 元件 JSX（改用 Tailwind utility）
- [ ] 3.3 保留 `:root` token、主題色彩變數（body.theme-*）、`::selection`、reset（`*`）、`html` scroll 設定、`button:focus-visible`、scrollbar、`prefers-reduced-motion` 在 `css/shared.css`
- [ ] 3.4 確認 `css/shared.css` 瘦身後不超過 310 行

## 4. style.css 遷移 — trip page 元件（trip-page-migrate）

- [ ] 4.1 建立 `css/overrides.css` 檔案，作為不可遷移規則的收容處
- [ ] 4.2 將 `.tl-flag` 的 `clip-path: polygon(...)` 規則移至 `overrides.css`
- [ ] 4.3 將 `body[class*="theme-"] .tl-card` 的 `color-mix()` + `backdrop-filter` 規則移至 `overrides.css`
- [ ] 4.4 將整個 `.print-mode` 區塊（~30 行）移至 `overrides.css`
- [ ] 4.5 將 `@media print` 區塊移至 `overrides.css`
- [ ] 4.6 將 `body.dark` 覆蓋規則移至 `overrides.css`
- [ ] 4.7 將 `.dh-nav-wrap::before/::after` gradient fade 移至 `overrides.css`
- [ ] 4.8 將 `.sg-priority-*::before` pseudo-element 移至 `overrides.css`
- [ ] 4.9 在 `src/app.css` 加入 `@import "../css/overrides.css" layer(components)`
- [ ] 4.10 遷移 `Timeline.tsx`：`.timeline` 樣式改為 Tailwind utility
- [ ] 4.11 遷移 `TimelineEvent.tsx`：`.tl-event`、`.tl-card`、`.tl-card-header`、`.tl-title`、`.tl-duration`、`.tl-desc`、`.tl-body`、`.tl-travel-content`、`.tl-travel-icon`、`.tl-travel-text` 改為 Tailwind utility
- [ ] 4.12 遷移 `DayNav.tsx`：`.day-header`、`.dh-date`、`.dh-nav-wrap`、`.dh-nav`、`.dn`、`.dh-nav-arrow` 改為 Tailwind utility
- [ ] 4.13 遷移 `Hotel.tsx`：`.col-row`、`.col-detail`、`.status-tag`、`.hotel-detail-grid`、`.hotel-sub` 改為 Tailwind utility
- [ ] 4.14 遷移 `Restaurant.tsx`：`.info-box`、`.restaurant-choice`、`.info-box-grid`、`.restaurant-meta` 改為 Tailwind utility
- [ ] 4.15 遷移 `Shop.tsx`：相關 info-box 樣式改為 Tailwind utility
- [ ] 4.16 遷移 `MapLinks.tsx`：`.nav-links`、`.map-link`、`.map-link-inline`、`.g-icon`、`.n-icon`、`.apple-icon` 改為 Tailwind utility
- [ ] 4.17 遷移 `HourlyWeather.tsx`：`.hourly-weather`、`.hw-grid`、`.hw-block`、`.hw-*` 系列改為 Tailwind utility
- [ ] 4.18 遷移 `InfoPanel.tsx`：`.info-panel`、`.info-card`、`.countdown-*`、`.stats-*` 改為 Tailwind utility
- [ ] 4.19 遷移 `SpeedDial.tsx`：`.speed-dial`、`.speed-dial-trigger`、`.speed-dial-items`、`.speed-dial-item`、`.speed-dial-label`、`.speed-dial-backdrop` 改為 Tailwind utility
- [ ] 4.20 遷移 `InfoSheet.tsx` / `InfoBox.tsx`：`.info-sheet-backdrop`、`.info-sheet-panel`、`.sheet-handle`、`.sheet-header`、`.sheet-close-btn`、`.sheet-title`、`.info-sheet-body` 改為 Tailwind utility
- [ ] 4.21 遷移 `DownloadSheet.tsx`：`.download-backdrop`、`.download-sheet`、`.download-option` 改為 Tailwind utility
- [ ] 4.22 遷移 `Footer.tsx`：`footer` 樣式改為 Tailwind utility
- [ ] 4.23 遷移 `Flights.tsx`：`.flight-row`、`.flight-info`、`.flight-label`、`.flight-route`、`.flight-time` 改為 Tailwind utility
- [ ] 4.24 遷移 `DrivingStats.tsx`：`.driving-stats`、`.driving-stats-detail`、`.transport-type-*` 改為 Tailwind utility
- [ ] 4.25 遷移 `Suggestions.tsx`：`.suggestion-card` 改為 Tailwind utility（`.sg-priority-*` 的 `::before` 保留在 overrides.css）
- [ ] 4.26 遷移 `Countdown.tsx`、`TripStatsCard.tsx`：`.countdown-*`、`.stats-*` 改為 Tailwind utility
- [ ] 4.27 遷移 `Checklist.tsx`、`Backup.tsx`、`Emergency.tsx`：overview card 樣式改為 Tailwind utility
- [ ] 4.28 遷移 `ThemeArt.tsx`：無 CSS class 依賴（inline style），確認不受影響
- [ ] 4.29 遷移 `InfoBox.tsx`：`.info-box` 各 variant 改為 Tailwind utility
- [ ] 4.30 遷移共用元件 `Icon.tsx`：`.svg-icon` 改為 Tailwind utility
- [ ] 4.31 遷移共用元件 `StickyNav.tsx`（如有）：`.sticky-nav` 改為 Tailwind utility
- [ ] 4.32 遷移共用元件 `ErrorBoundary.tsx`：`.trip-error`、`.trip-error-link` 改為 Tailwind utility
- [ ] 4.33 刪除 `css/style.css`（所有規則已遷移至 Tailwind utility 或 overrides.css）

## 5. 頁面 CSS 遷移（page-css-migrate）

- [ ] 5.1 遷移 `SettingPage.tsx`：將 `css/setting.css` 所有樣式改為 Tailwind utility，包含 `.setting-page`、`.setting-section`、`.color-mode-grid`、`.color-mode-card`、`.color-mode-preview`、`.cmp-*`、`.color-theme-grid`、`.color-theme-card`
- [ ] 5.2 將 `css/setting.css` 中 `html.page-setting` 的 scroll 重置規則移至 `overrides.css`
- [ ] 5.3 刪除 `css/setting.css`
- [ ] 5.4 遷移 `ManagePage.tsx`：將 `css/manage.css` 所有樣式改為 Tailwind utility，包含 `.chat-container`、`.chat-messages`、`.request-list`、`.request-item`、`.manage-input-bar`、`.manage-input-card`、`.manage-textarea`、`.manage-mode-toggle`、`.manage-mode-pill`、`.manage-send-btn`、`.manage-trip-select`
- [ ] 5.5 將 `css/manage.css` 中 `body.dark` 覆蓋和不可遷移規則移至 `overrides.css`
- [ ] 5.6 刪除 `css/manage.css`
- [ ] 5.7 遷移 `AdminPage.tsx`：將 `css/admin.css` 所有樣式改為 Tailwind utility，包含 `.admin-page`、`.admin-section`、`.admin-section-card`、`.admin-trip-select`、`.admin-permission-*`、`.admin-add-form`、`.admin-email-input`、`.admin-add-btn`
- [ ] 5.8 將 `css/admin.css` 中 `html.page-admin` scroll 重置和 `.admin-permission-item:not(:last-child)` 規則移至 `overrides.css`
- [ ] 5.9 刪除 `css/admin.css`
- [ ] 5.10 遷移 edit page 元件：將 `css/edit.css` 所有樣式改為 Tailwind utility（結構與 manage.css 極相似）
- [ ] 5.11 將 `css/edit.css` 中 `body.dark` 覆蓋移至 `overrides.css`
- [ ] 5.12 刪除 `css/edit.css`

## 6. 測試與驗證（testing）

- [ ] 6.1 執行 `npx tsc --noEmit` 確認零 TypeScript 錯誤
- [ ] 6.2 執行 `npm run build` 確認 Vite 構建成功
- [ ] 6.3 執行 `npm test` 確認所有 unit/integration 測試通過
- [ ] 6.4 檢查 `css-hig.test.js` 是否需要更新以適應新的 CSS 架構
- [ ] 6.5 手動驗證 4 個頁面的視覺正確性（index / setting / manage / admin）
- [ ] 6.6 驗證 3 套主題 × light/dark 切換正常
- [ ] 6.7 驗證列印模式正常（`.print-mode` + `@media print`）
- [ ] 6.8 驗證 `prefers-reduced-motion` 動畫降級正常
- [ ] 6.9 驗證手機版響應式佈局（600px / 768px / 1200px 斷點）
- [ ] 6.10 執行 `/tp-code-verify` 確認所有程式碼品質規則通過
