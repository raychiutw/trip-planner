## Why

自駕行程還車前必須加滿油，否則會被收取高額加油費。目前 Ray 和 HuiYun 的行程碰巧有附上加油站資訊，但這不是正式的品質規則——未來新增自駕行程時 Claude 不一定會自動補上。需要將「還車附加油站」正式化為品質規則，並加入自動驗證。

同時，目前沒有欄位可判斷行程是否為自駕，需在 `meta` 新增 `tripType` 欄位讓規則可以精確觸發。

## What Changes

- `meta` 新增 `tripType` 欄位（`"self-drive"` | `"transit"` | `"mixed"`），用於判斷行程交通類型
- 新增 `gasStation` infoBox type，結構化呈現加油站資訊（名稱、地址、營業時間、服務類型、電話、location）
- 新增品質規則 R10：自駕行程的還車事件 SHALL 包含 gasStation infoBox，優先推薦人工加油站
- 現有 Ray / HuiYun 的加油站資料從 `reservation` type 遷移為 `gasStation` type
- `/render-trip` 新增邏輯：無法從行程判斷 tripType 時，提問使用者
- Schema 驗證 + Quality 驗證擴充

## Capabilities

### New Capabilities
- `gas-station-quality`: 自駕行程還車加油站品質規則（R10）、gasStation infoBox type 定義、tripType meta 欄位

### Modified Capabilities
- `trip-enrich-rules`: 新增 R10 還車加油站規則
- `trip-json-validation`: 新增 gasStation infoBox schema 驗證 + tripType meta 欄位驗證 + R10 quality test

## Impact

- **JSON 結構**：`meta` 新增 `tripType`；infoBoxes 新增 `gasStation` type
- **資料檔案**：4 個行程 JSON 需補 `tripType`；Ray / HuiYun 加油站 infoBox 遷移
- **測試**：`tests/json/schema.test.js` 新增 gasStation + tripType 驗證；`tests/json/quality.test.js` 新增 R10 檢查
- **規則檔**：`rules-json-schema.md` 新增欄位定義；`render-trip.md` 新增 R10
- **渲染**：`app.js` 需新增 `renderGasStation()` 函式處理 gasStation infoBox 顯示
- **checklist/backup/suggestions 連動**：無直接影響（加油站資訊在 timeline event 的 infoBox 層級）
