## 1. Service Worker 設定

- [x] 1.1 安裝 vite-plugin-pwa（`npm install -D vite-plugin-pwa`）
- [x] 1.2 修改 `vite.config.ts`：加入 VitePWA plugin 配置（precache + runtimeCaching NetworkFirst for /api/*）
- [x] 1.3 確認 `public/manifest.json` 已存在（前一個 change 已建立），設定 `manifest: false` 避免重複

## 2. 離線狀態 Hook

- [x] 2.1 新增 `src/hooks/useOnlineStatus.ts`：偵測 navigator.onLine + online/offline 事件

## 3. 離線 UI

- [x] 3.1 在 `src/pages/TripPage.tsx` 加入離線提示橫幅（StickyNav 下方）
- [x] 3.2 在 `css/style.css` 加入離線橫幅樣式（warning 背景 + fade 動畫）
- [x] 3.3 離線時 SpeedDial disabled（opacity + pointer-events: none）
- [x] 3.4 離線時 QuickPanel 寫入項目 disabled

## 4. 上線恢復

- [x] 4.1 上線時橫幅改「已恢復連線」→ 2 秒後淡出

## 5. Manage / Admin 離線提示

- [x] 5.1 修改 `src/pages/ManagePage.tsx`：離線時顯示全頁離線提示，隱藏操作功能
- [x] 5.2 修改 `src/pages/AdminPage.tsx`：同上

## 6. 測試

- [x] 6.1 執行 `npx tsc --noEmit` + `npm test` 確認全過
- [x] 6.2 執行 `npm run build` 確認 SW 正確生成
