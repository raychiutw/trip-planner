## 1. Reservation JSON 解析渲染

- [x] 1.1 `Restaurant.tsx`：解析 reservation 欄位 — 若為 object 依 method 渲染（website 連結 / phone tel: 連結 / no 不顯示），若為 string 維持原有邏輯
- [x] 1.2 `RestaurantData` interface 擴充 reservation 型別為 `string | ReservationInfo | null`

## 2. InfoPanel 還原

- [x] 2.1 `InfoPanel.tsx`：移除 flights/checklist/backup/emergency/suggestions/tripDrivingStats props 和渲染，只保留 Countdown + TripStatsCard
- [x] 2.2 `TripPage.tsx`：移除傳給 InfoPanel 的 doc 相關 props

## 3. SpeedDial 順序還原

- [x] 3.1 `SpeedDial.tsx`：DIAL_ITEMS 順序改為 flights → checklist → backup → emergency → suggestions → driving

## 4. 交通路段名稱

- [x] 4.1 `drivingStats.ts`：Segment interface 擴充 `from?: string` 和 `to?: string`
- [x] 4.2 `drivingStats.ts`：`calcDrivingStats()` 從 entries[i].title → entries[i+1].title 推導 from/to
- [x] 4.3 `DrivingStats.tsx`：渲染每段交通的「from → to」路段名稱

## 5. 驗證

- [x] 5.1 `npx tsc --noEmit` TypeScript 零錯誤
- [x] 5.2 `npm test` 全部通過
