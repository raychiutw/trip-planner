## Why

旅行中經常處於弱網或無網環境（飛機上、偏遠景點、地下鐵）。目前離線 = 白頁，是網站與原生 App 最大的體驗差距。需求：離線可瀏覽既有行程，編輯功能停用。

## What Changes

- **Service Worker**：vite-plugin-pwa 產生，App Shell precache（HTML/CSS/JS/icons）
- **API 快取**：Cache API + NetworkFirst 策略，只快取 GET（讀取），不快取寫入
- **離線狀態 UI**：偵測 online/offline 事件，離線時顯示提示橫幅 + 停用編輯功能
- **上線恢復**：自動刷新資料 + 短暫提示「已恢復連線」

## Capabilities

### New Capabilities
- `offline-experience`: Service Worker 離線快取 + 離線狀態 UI

### Modified Capabilities
（無）

## Impact

- **新增依賴**：vite-plugin-pwa
- **修改**：`vite.config.ts`（PWA plugin）、`src/pages/TripPage.tsx`（離線橫幅 + 編輯停用）
- **CSS**：離線橫幅樣式
- **不改**：API 端點、資料層、其他頁面
