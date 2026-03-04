## Tasks

### 1. 規則檔更新

- [x] 1.1 `rules-json-schema.md` 新增 `meta.tripType` 欄位定義（`"self-drive"` | `"transit"` | `"mixed"`，必填）
- [x] 1.2 `rules-json-schema.md` 新增 `gasStation` infoBox type 定義（station 物件含 name/address/hours/service/phone，選填 location）
- [x] 1.3 `.claude/commands/render-trip.md` 新增 R10 還車加油站規則說明

### 2. Schema 驗證

- [x] 2.1 `tests/json/schema.test.js` 新增 `meta.tripType` 欄位驗證（存在 + 值為三者之一）
- [x] 2.2 `tests/json/schema.test.js` 新增 `gasStation` infoBox 結構驗證（station 必填欄位 + location 選填驗證）

### 3. Quality 驗證

- [x] 3.1 `tests/json/quality.test.js` 新增 R10：自駕行程還車事件須有 gasStation infoBox

### 4. 資料遷移 — tripType

- [x] 4.1 Ray JSON 新增 `meta.tripType: "self-drive"`
- [x] 4.2 HuiYun JSON 新增 `meta.tripType: "self-drive"`
- [x] 4.3 RayHus JSON 新增 `meta.tripType: "transit"`
- [x] 4.4 Onion JSON 新增 `meta.tripType: "self-drive"`

### 5. 資料遷移 — gasStation infoBox

- [x] 5.1 Ray JSON：還車事件的加油站從 `reservation` infoBox 遷移為 `gasStation` type
- [x] 5.2 HuiYun JSON：還車事件的加油站從 `reservation` infoBox 遷移為 `gasStation` type

### 6. 渲染

- [x] 6.1 `js/app.js` renderInfoBox() 新增 `case 'gasStation'`，使用 `gas-station` icon，渲染 station 資訊

### 7. 驗證

- [x] 7.1 執行 `npm test` 確認所有測試通過
