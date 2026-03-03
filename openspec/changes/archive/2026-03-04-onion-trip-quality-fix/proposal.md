## Why

Onion 的板橋之旅（15 日國內行程）結構極為骨架式：每天僅 2 個 timeline entry、完全沒有餐廳推薦、景點無 titleUrl。雖然是國內在地行程，基本品質規則仍應適用——至少每日應有餐廳推薦，景點應有參考連結。

## What Changes

- **R2 餐次完整性**：15 天每日補上午餐和晚餐推薦（以各區在地美食為主）
- **R3 餐廳品質**：每個餐廳 infoBox 含 3 家推薦，每家附 hours/reservation/blogUrl
- **R4 景點品質**：所有景點 timeline entry 補上 `titleUrl`（官網）和 `blogUrl`（繁中網誌）
- **R7 購物推薦**：視各區特色補上購物/市場 infoBox（如板橋大遠百、夜市等）

## Capabilities

### New Capabilities

（無新增 capability）

### Modified Capabilities

- `trip-enrich-rules`：無規則變更，僅依既有 R2/R3/R4/R6/R7 規則補齊 Onion 行程的缺漏

## Impact

- 僅修改 `data/trips/banqiao-trip-2026-Onion.json`
- 無 JS/CSS/HTML 變更
- 新增大量餐廳/景點資料，需同步更新 suggestions 區塊
