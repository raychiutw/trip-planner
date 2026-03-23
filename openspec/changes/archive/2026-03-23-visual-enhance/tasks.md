## 1. 晴空色碼（sky-theme-contrast）

- [ ] 1.1 修改 `css/shared.css`：`body.theme-sky` 中 `--accent` → `#2870A0`
- [ ] 1.2 修改 `css/shared.css`：`body.theme-sky` 中 `--accent-bg` → `#B8D4E8`
- [ ] 1.3 修改 `css/shared.css`：`body.theme-sky` 中 `--accent-subtle` → `#D0E4F2`
- [ ] 1.4 修改 `css/shared.css`：`body.theme-sky` 中 `--border` → `#A0C0D8`
- [ ] 1.5 修改 `css/shared.css`：`body.theme-sky` 中 `--text-muted` → `#587888`
- [ ] 1.6 修改 `css/shared.css`：`body.theme-sky` 中 `--bg-secondary` → `#E0EDF5`
- [ ] 1.7 修改 `css/shared.css`：`body.theme-sky` 中 `--bg-tertiary` → `#C8DDE8`
- [ ] 1.8 確認 `body.theme-sky.dark` 的所有變數未被異動
- [ ] 1.9 確認 `--bg: #FFF9F0` 維持不變

## 2. 插畫加大（day-header-art-enlarge）

- [ ] 2.1 修改 `src/components/trip/ThemeArt.tsx`：`DayHeaderArt` 容器 `width` 由 `'60%'` 改為 `'80%'`
- [ ] 2.2 修改 `css/style.css`：`.day-header` 新增或覆蓋 `min-height: 100px`
- [ ] 2.3 修改 `ThemeArt.tsx` 中 `SkyLightHeader` SVG 元素座標與縮放，使熱氣球、海鷗更靠近中央且放大（不超出 viewBox 200×80）
- [ ] 2.4 在 `src/components/trip/ThemeArt.tsx` 新增 `NavArt` function component（接收 `theme` 與 `dark` props，回傳高度 24px 的 SVG）
- [ ] 2.5 實作 `NavArt` 六組（sun light/dark、sky light/dark、zen light/dark）SVG 裝飾內容
- [ ] 2.6 匯出 `NavArt` 並在 `TripPage.tsx` 或 `StickyNav` 注入（aria-hidden、position absolute、pointer-events none）

## 3. 列印模式（print-mode-whitebg）

- [ ] 3.1 在 `css/style.css` `.print-mode` 區塊新增 `.tl-card` 與 `.info-card` 純白 + border + backdrop-filter none 規則
- [ ] 3.2 在 `css/style.css` `.print-mode` 區塊新增 `.day-header` 純白 + border-bottom 規則
- [ ] 3.3 在 `css/style.css` `@media print` 區塊新增 `.tl-card`、`.info-card`、`.day-header` 對應規則（含 `!important`）
- [ ] 3.4 手動驗證：開啟列印模式後卡片為純白且無毛玻璃殘影

## 4. Speed Dial（speed-dial-download）

- [ ] 4.1 在 `css/style.css` 新增 `.speed-dial-item svg { width: 28px; height: 28px; }` 規則
- [ ] 4.2 確認 `.speed-dial-item` 按鈕本身尺寸未被 SVG 撐大（必要時加 `overflow: hidden` 或 `flex-shrink: 0`）
- [ ] 4.3 在 `src/components/shared/Icon.tsx` 的 `ICONS` 新增 `download` key 與 Material Symbols 路徑
- [ ] 4.4 在 `src/components/trip/SpeedDial.tsx` 的 `DIAL_ITEMS` 末尾新增 `{ key: 'download', icon: 'download', label: '下載行程' }`
- [ ] 4.5 在 `SpeedDial.tsx` 的 `handleItemClick` 中處理 `download` key：呼叫新增的 `onDownload` callback 或設定 `isDownloadOpen` state
- [ ] 4.6 建立 `src/components/trip/DownloadSheet.tsx`，實作 bottom sheet 骨架（isOpen/onClose/sheet-handle/backdrop）
- [ ] 4.7 實作 DownloadSheet PDF 按鈕（呼叫 `window.print()`）
- [ ] 4.8 實作 DownloadSheet JSON 按鈕（API fetch + Blob 下載，檔名 `{tripName}-{date}.json`）
- [ ] 4.9 實作 DownloadSheet Markdown 按鈕（多次 API fetch 組裝 MD + Blob 下載）
- [ ] 4.10 實作 DownloadSheet CSV 按鈕（攤平 entries → CSV 字串 + Blob 下載）
- [ ] 4.11 實作下載中 loading 狀態（按鈕 disabled + 視覺 spinner）
- [ ] 4.12 在 `TripPage.tsx` 整合 `DownloadSheet`（傳入 tripId、tripName、isOpen、onClose）
- [ ] 4.13 更新 `SpeedDial` 的 `SpeedDialProps`：新增 `onDownload?: () => void`（或在 TripPage 以 state 控制）

## 5. Build + 驗證

- [ ] 5.1 執行 `npm run build`，確認無 TypeScript 錯誤、無 Vite 警告
- [ ] 5.2 執行 `/tp-code-verify` 驗證程式碼品質規則
- [ ] 5.3 執行 `npm run test:unit` 確認現有 unit tests 均通過
- [ ] 5.4 若 `css-hig.test.js` 有 CSS token 驗證，確認 `.speed-dial-item svg` 規則符合規範
