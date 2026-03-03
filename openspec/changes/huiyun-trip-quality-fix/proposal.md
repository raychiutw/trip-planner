## Why

HuiYun 的沖繩之旅行程 JSON 存在多項 R1-R7 品質缺漏：餐廳推薦數量不足（多處僅 1 家，規則要求 3 家）、1 家餐廳缺 blogUrl、飛行段 transit 缺 type、購物 infoBox 內容不足。需逐一補齊以符合品質標準。

## What Changes

- **R3 餐廳數量補齊**：Day 2/4/5/6 各 restaurants infoBox 補到 3 家（含 hours/reservation/blogUrl）
- **R3 餐廳 blogUrl**：補齊 Day 5 晚餐「爐端燒 Uguisu」的 `blogUrl`
- **R2 餐次完整性**：檢查各日是否缺午餐/晚餐，Day 1/3/7 視情況補齊
- **transit type**：Day 1 桃園機場→那霸飛行段補上 `type` 欄位
- **R7 購物 infoBox**：Day 6 伴手禮推薦補充更多 shop 項目與 mustBuy

## Capabilities

### New Capabilities

（無新增 capability）

### Modified Capabilities

- `trip-enrich-rules`：無規則變更，僅依既有 R2/R3/R6/R7 規則補齊 HuiYun 行程的缺漏

## Impact

- 僅修改 `data/trips/okinawa-trip-2026-HuiYun.json`
- 無 JS/CSS/HTML 變更
- 餐廳新增可能需同步更新 suggestions（若建議卡中提及餐廳選擇）
