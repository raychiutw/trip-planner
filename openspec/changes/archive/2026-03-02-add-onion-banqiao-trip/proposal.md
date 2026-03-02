## Why

需要一個測試行程來驗證 UI 改版（配色、聊天化、info-sheet 等）在多天數行程下的表現。Onion 的 15 天板橋行程作為長天數本地行程的測試案例，所有 Day 住宿固定為家、交通為開車。

## What Changes

- 新增 `data/trips/banqiao-trip-2026-Onion.json`：15 天板橋測試行程
- 更新 `data/trips.json`：新增 Onion 的行程索引項目
- 每天包含：住宿（家）、1-2 個 placeholder 景點、開車交通
- 日期：2026/4/1（三）~ 4/15（二）

## Capabilities

### New Capabilities

（無新功能，純資料新增）

### Modified Capabilities

（無）

## Impact

- 影響檔案：`data/trips.json`、`data/trips/banqiao-trip-2026-Onion.json`（新增）
- 不涉及 JS/CSS/HTML 變更
- 不涉及 JSON 結構變更（沿用現有 schema）
