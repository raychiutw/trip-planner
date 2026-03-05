## Why

行程 JSON 已有 `googleRating` 欄位（R12 品質規則要求），但頁面完全沒有渲染這些資料。使用者無法在行程頁面上看到景點、餐廳、商店的 Google 評分，影響旅行決策參考。

## What Changes

- **渲染 googleRating**：所有 POI（景點 timeline event、餐廳、商店）在頁面上顯示 Google 評分，格式為 `★ 4.5`
- **品質規則升級**：R12 從 warn 級（黃燈）升級為 strict 級（紅燈），所有 POI 必須有 googleRating
- **補齊缺失資料**：重掃所有行程 JSON，補上缺少 googleRating 的 POI

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `trip-json-validation`：googleRating schema 驗證維持選填不變（schema 層不強制）
- `trip-enrich-rules`：R12 從 SHOULD（warn）改為 SHALL（strict），所有 POI 必須有 googleRating

## Impact

- **JS**：`js/app.js` — `renderTimelineEvent()`、`renderRestaurant()`、`renderShop()` 新增 rating 顯示
- **CSS**：`css/style.css` — 新增 rating 顯示樣式（星星 + 數字）
- **JSON**：`data/trips/*.json` — 補齊所有缺失的 googleRating
- **品質規則**：`.claude/commands/trip-quality-rules.md` — R12 升級為 strict
- **測試**：`tests/unit/render.test.js` — 新增 rating 渲染測試
- 不影響 checklist/backup/suggestions（JSON 結構不變，僅補值）
