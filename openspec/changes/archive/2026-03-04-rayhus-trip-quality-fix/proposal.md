## Why

RayHus 的沖繩之旅（6 日非自駕行程）品質缺漏最為嚴重：全部餐廳缺 blogUrl、全部飯店缺 blogUrl、全部景點缺 titleUrl、無購物 infoBox、部分日程缺晚餐、餐廳推薦數量不足。此行程即將於 3/6 出發，急需補齊。

## What Changes

- **R3 餐廳 blogUrl**：全部 4 家餐廳補上 `blogUrl`
- **R3 餐廳數量**：Day 1/2 各 infoBox 從 2 家補到 3 家
- **R2 餐次完整性**：Day 3（Klook 一日遊）補晚餐；Day 4/5/6 檢查並補齊午餐/晚餐
- **R4 景點品質**：所有景點 timeline entry 補上 `titleUrl` 和 `blogUrl`
- **R5 飯店 blogUrl**：Living Inn 旭橋駅前、THE NEST NAHA 兩間飯店補上 `url`
- **R7 購物 infoBox**：Day 4 來客夢、Day 5 iias 豐崎補上 shopping infoBox
- **emergency**：補上緊急聯絡資訊區塊

## Capabilities

### New Capabilities

（無新增 capability）

### Modified Capabilities

- `trip-enrich-rules`：無規則變更，僅依既有 R2/R3/R4/R5/R6/R7 規則全面補齊 RayHus 行程

## Impact

- 僅修改 `data/trips/okinawa-trip-2026-RayHus.json`
- 無 JS/CSS/HTML 變更
- 大量新增資料，需同步更新 suggestions 區塊
