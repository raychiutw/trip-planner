## Why

Ray 的沖繩之旅行程 JSON 有數項不符合 R1-R7 品質規則的缺漏：餐廳缺 `blogUrl`、飯店缺 `blogUrl`，需逐一補齊以維持行程資料的一致性與實用性。

## What Changes

- 補齊 Day 2 晚餐「麵屋はちれん」的 `blogUrl`
- 補齊 Day 3 午餐「焼肉げんか」的 `blogUrl`
- 補齊 Day 2-3 連住「Super Hotel 沖縄・名護」的 `url`（blogUrl）

## Capabilities

### New Capabilities

（無新增 capability）

### Modified Capabilities

- `trip-enrich-rules`：無規則變更，僅依既有 R3/R5/R6 規則補齊 Ray 行程的缺漏欄位

## Impact

- 僅修改 `data/trips/okinawa-trip-2026-Ray.json`
- 無 JS/CSS/HTML 變更
- 無 checklist/backup/suggestions 結構性影響（僅補欄位值，不變動結構）
