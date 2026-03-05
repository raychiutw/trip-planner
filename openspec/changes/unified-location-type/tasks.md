## 1. gasStation 資料扁平化

- [x] 1.1 遷移 `okinawa-trip-2026-Ray.json` 的 gasStation infoBox：將 `station.*` 欄位提升到 infoBox 頂層，移除 `station` wrapper
- [x] 1.2 遷移 `okinawa-trip-2026-HuiYun.json` 的 gasStation infoBox：同上

## 2. gasStation render 更新

- [x] 2.1 修改 `js/app.js` 第 164-180 行 gasStation case：從 `box.station.*` 改為直接讀 `box.*`

## 3. Schema 驗證更新

- [x] 3.1 更新 `tests/json/schema.test.js`：新增 MapLocation 物件驗證函數，檢查 `name`（非空字串）、`googleQuery`（https:// 開頭）、`appleQuery`（https:// 開頭）、`mapcode`/`label`（選填字串）
- [x] 3.2 更新 `tests/json/schema.test.js`：在 timeline event 的 `locations[]` 驗證中套用 MapLocation 驗證
- [x] 3.3 更新 `tests/json/schema.test.js`：在 restaurants infoBox 的 `restaurant.location` 驗證中套用 MapLocation 驗證
- [x] 3.4 更新 `tests/json/schema.test.js`：在 shopping infoBox 的 `shop.location` 驗證中套用 MapLocation 驗證
- [x] 3.5 更新 `tests/json/schema.test.js`：gasStation infoBox 驗證改為扁平結構（`box.name` 取代 `box.station.name`），location 套用 MapLocation 驗證

## 4. Quality R11 規則

- [x] 4.1 新增 `tests/json/quality.test.js` R11 規則：warn 模式檢查 timeline event 是否有 `locations[]`（跳過非實體地點事件：交通、餐廳未定、純描述）
- [x] 4.2 新增 `tests/json/quality.test.js` R11 規則：warn 模式檢查 restaurant 是否有 `location`
- [x] 4.3 新增 `tests/json/quality.test.js` R11 規則：warn 模式檢查 gasStation 是否有 `location`

## 5. Spec 文件同步

- [x] 5.1 更新 `rules-json-schema.md`：加入 MapLocation 型別定義、gasStation 扁平結構說明
- [x] 5.2 更新 `/tp-rebuild` skill（`.claude/commands/tp-rebuild.md`）：R10 加油站描述改為扁平結構，新增 R11 規則摘要

## 6. 驗證

- [x] 6.1 執行 `npm test` 確認所有測試通過
