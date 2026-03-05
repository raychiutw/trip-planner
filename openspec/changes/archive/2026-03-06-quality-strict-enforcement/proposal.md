## Why

品質規則 R1-R12 目前並非全部嚴格執行。R1/R3 的餐廳 category 對齊偏好只用 `console.warn`；R4 景點 blogUrl、R11 地圖導航、R12 Google 評分完全沒有自動化測試。這些規則已趨成熟，所有行程資料也已具備基本品質，是時候全面升級為 strict 級測試。

## What Changes

- **R1/R3 category 對齊**：`quality.test.js` 的 `console.warn` 改為 `expect` 斷言（紅燈）
- **R4 景點 blogUrl**：新增測試，非 travel、非「餐廳未定」的景點須有 `blogUrl` 欄位
- **R11 location**：新增測試，實體地點類 event 須有 `locations[]`，餐廳須有 `location`
- **R12 googleRating**：新增測試，實體地點類 event、餐廳、商店須有 `googleRating`（1.0-5.0）
- **補齊資料**：`/tp-rebuild-all` 重掃全部行程，修正所有違規項

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `trip-json-validation`：googleRating schema 驗證維持選填（品質層強制）
- `trip-enrich-rules`：R4 blogUrl、R11 location、R12 googleRating 從 SHOULD/warn 升級為 SHALL/strict；R1/R3 category 從 warn 升級為 strict

## Impact

- **測試**：`tests/json/quality.test.js` — 修改 1 個測試（R1/R3）+ 新增 3 個測試（R4、R11、R12）
- **品質規則**：`.claude/commands/trip-quality-rules.md` — R11、R12 措辭確認 SHALL
- **JSON**：`data/trips/*.json` — 補齊缺少的 blogUrl/location/googleRating
- **Specs**：`openspec/specs/trip-enrich-rules/spec.md` — 同步更新
- 不影響 JS/CSS/HTML
- 不影響 checklist/backup/suggestions（JSON 結構不變，僅補值）
