## Why

React 19 遷移後，部分元件行為與舊版 vanilla JS 不一致，造成：
1. 餐廳訂位資訊（reservation）破版 — DB 儲存 JSON 物件但前端當字串渲染，直接 dump 出 raw JSON
2. 桌面 InfoPanel 顯示過多內容 — 舊版只有 Countdown + TripStatsCard，React 版多了 6 張卡片
3. SpeedDial 按鈕順序與舊版不同
4. 交通統計缺少「哪裡到哪裡」路段資訊

## What Changes

- **Reservation JSON 解析**：`Restaurant.tsx` 解析 reservation JSON 物件，依 `method` 渲染為網站連結 / 電話 / 免預約
- **InfoPanel 還原**：移除 flights/checklist/backup/emergency/suggestions/drivingStats，只保留 Countdown + TripStatsCard
- **SpeedDial 順序還原**：DIAL_ITEMS 改回舊版順序（flights → checklist → backup → emergency → suggestions → driving）
- **交通路段名稱**：`Segment` 擴充 `from/to` 欄位，`calcDrivingStats` 從前後 entry title 推導，`DrivingStats.tsx` 渲染「起點 → 終點」

## Capabilities

### New Capabilities

- `reservation-json-render`: 餐廳訂位欄位從 JSON 物件正確解析並渲染（三種模式：website/phone/no）
- `driving-segment-route`: 交通統計每段顯示起點→終點名稱

### Modified Capabilities

- `info-panel-always-render`: 桌面 sidebar 還原為只顯示 Countdown + TripStatsCard（移除多餘卡片）

## Impact

影響檔案：
- `src/components/trip/Restaurant.tsx` — reservation 渲染邏輯
- `src/components/trip/InfoPanel.tsx` — 移除 6 個 doc 卡片
- `src/components/trip/SpeedDial.tsx` — DIAL_ITEMS 順序
- `src/lib/drivingStats.ts` — Segment 型別 + calcDrivingStats 邏輯
- `src/components/trip/DrivingStats.tsx` — 路段名稱渲染
- `src/pages/TripPage.tsx` — InfoPanel props 精簡

無 DB schema 變更、無 API 變更、無 checklist/backup/suggestions 連動影響。
