## 1. Night 主題（取代 Ocean）

- [x] 1.1 `css/shared.css`：新增 `.theme-night` + `.theme-night.dark` 色彩 token，刪除 `.theme-ocean` + `.theme-ocean.dark`
- [x] 1.2 `src/hooks/useDarkMode.ts`：ColorTheme 移除 `'ocean'` 加入 `'night'`、THEME_COLORS 更新、`readColorTheme()` 加入 ocean→night 遷移
- [x] 1.3 `src/pages/SettingPage.tsx`：主題選擇器 ocean→night（label「星夜」、accent `#6B6B6B`）
- [x] 1.4 Unit test：night theme token 存在、ocean→night 遷移、THEME_COLORS 正確

## 2. QuickPanel 元件

- [x] 2.1 新增 `src/components/trip/QuickPanel.tsx`：Bottom Sheet 結構 + 14 項 grid + FAB 上下箭頭 + backdrop + 開關動畫
- [x] 2.2 新增 QuickPanel CSS（`css/style.css`）：grid 排版、分隔線、動畫、body scroll lock、`@media print` 隱藏
- [x] 2.3 實作 grid 項目 click handler：sheet action → `onItemClick`、print action → `onPrint`、download action → `onDownload`
- [x] 2.4 實作 drill-down view state（`grid` / `trip-select` / `appearance`），左右滑動切換動畫
- [x] 2.5 實作「切換行程」drill-down：fetch `/api/trips` 顯示已發布行程列表、選中標記、點擊切換行程
- [x] 2.6 實作「外觀主題」drill-down：色彩模式切換（淺/深/自動）+ 6 主題選擇（含 night），即時生效不關閉
- [x] 2.7 Unit test：QuickPanel render、14 項順序、每項只一個 label、FAB 方向、drill-down 切換

## 3. TripPage 整合

- [x] 3.1 `TripPage.tsx`：import QuickPanel 取代 SpeedDial、移除 DownloadSheet import 和 state、接線 QuickPanel props
- [x] 3.2 `TripPage.tsx`：下載功能（PDF/MD/JSON/CSV）直接由 QuickPanel 觸發，移除 DownloadSheet 相關邏輯
- [x] 3.3 刪除 `src/components/trip/SpeedDial.tsx`、`src/components/trip/DownloadSheet.tsx`
- [x] 3.4 `css/style.css`：移除 `.speed-dial-*` 和 `.download-*` CSS 規則
- [x] 3.5 更新現有 SpeedDial 相關 unit test → QuickPanel

## 4. Bug 修復

- [x] 4.1 `src/lib/mapDay.ts`：`buildLocation()` 修正 — maps 非 URL 時作為 name fallback
- [x] 4.2 `src/pages/TripPage.tsx`：URL `?trip=` 參數優先權修正 — 確保 URL 參數不被 localStorage 覆蓋
- [x] 4.3 `css/style.css`：預約連結（`.reservation-link` 或等效）min-height 調整為 `var(--tap-min)` 44px
- [x] 4.4 Unit test：buildLocation fallback、URL trip 參數優先權
- [x] 4.5 透過 API 補建 AeronAn + Onion 行程的 emergency 文件

## 5. 整合測試 + 清理

- [x] 5.1 `npx tsc --noEmit` 全過
- [x] 5.2 `npm test` 全過（含新增的 unit test）
- [x] 5.3 E2E test：QuickPanel 開關 + grid 點擊 + drill-down + 下載 + 主題切換
- [x] 5.4 刪除 `.speed-dial-*` 和 `.download-sheet` 相關 CSS/JS 殘留
