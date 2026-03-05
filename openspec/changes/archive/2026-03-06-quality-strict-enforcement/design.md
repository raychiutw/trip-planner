## Context

`quality.test.js` 已涵蓋 R2/R3/R5/R7/R8/R9/R10 的 strict 測試。R1/R3 category 對齊目前用 `console.warn` 不中斷測試；R4 景點 blogUrl、R11 location、R12 googleRating 完全沒有測試。現有行程資料在前幾輪 rebuild 中已大幅補齊，但仍可能有零星缺失。

## Goals / Non-Goals

**Goals:**
- `quality.test.js` 中所有 R1-R12 可自動化的規則均為 strict（`expect` 斷言，失敗即紅燈）
- 所有行程 JSON 資料通過全部 strict 測試
- R6 搜尋方式為程序性指引，不自動化測試

**Non-Goals:**
- 不改 JS/CSS 渲染邏輯（渲染由 `render-google-rating` change 處理）
- 不改 schema.test.js（schema 層 googleRating 仍為選填）
- 不新增品質規則，僅升級既有規則的嚴格度

## Decisions

### D1：R1/R3 category 對齊改為 strict

將 `quality.test.js` 第 260 行的 `console.warn` 改為 `expect(cat.includes(prefs[m])).toBe(true)`。現有行程資料的 category 不完全符合偏好（如偏好 "義大利麵" 但 category 是 "義式料理"），改為 strict 前須先修正資料或放寬比對邏輯（改用模糊匹配、同義詞對映等）。

**決策：先修正資料，不改比對邏輯。** category 應直接使用 foodPreferences 中的值，而非近似值。rebuild 時統一修正 category 以精確對齊 foodPreferences。

### D2：R4 景點 blogUrl 測試

新增測試：遍歷所有 timeline event，排除 travel event（含 `travel` 物件）和「餐廳未定」事件，檢查 `blogUrl` 欄位存在（允許空字串 `""`，表示查不到）。

### D3：R11 location 測試

新增測試：
- timeline event（非 travel、非「餐廳未定」）須含 `locations[]` 陣列
- restaurant 須含 `location` 物件
- gasStation 須含 `location` 物件
- shop location 不強制（R11 spec 為建議性）

### D4：R12 googleRating 測試

新增測試：
- timeline event（非 travel、非「餐廳未定」）須含 `googleRating`（數字 1.0-5.0）
- restaurant 須含 `googleRating`
- shop 須含 `googleRating`（配合 render-google-rating change 升級為必填）

### D5：資料補齊策略

修改 `trip-quality-rules.md` 確認 R11/R12 措辭為 SHALL，然後執行 `/tp-rebuild-all` 補齊缺失資料。rebuild 完成後 `npm test` 須全部通過。

## Risks / Trade-offs

- [R1/R3 category 嚴格化可能導致大量測試失敗] → 先 rebuild 修正 category 資料再開啟 strict 測試
- [R4 blogUrl 部分景點查不到繁中文章] → 允許空字串 `""`，只要欄位存在即通過
- [R11 location 資料量大] → 前幾輪 rebuild 已大幅補齊，剩餘少量由 rebuild-all 處理
