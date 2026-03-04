## Why

`renderHotel()` 缺少對 `hotel.infoBoxes`、`breakfast`、`checkout` 的渲染，導致飯店購物推薦、早餐資訊、退房時間等資料存在於 JSON 但前端完全不顯示。同時四個行程檔的 hotel.subs 格式不統一（Ray 用舊格式 `{label,text}`、HuiYun 用新格式 `{type,title,price,note}` 且購物仍混在 subs）、多處欄位缺漏不一致、以及 `meta.themeColor`/`meta.name` 等無用欄位殘留。

## What Changes

1. **renderHotel 渲染補齊**
   - `hotel.infoBoxes` → 呼叫既有 `renderInfoBox()` 渲染 shopping/gasStation/restaurants
   - `hotel.breakfast` → 顯示含/不含早餐 + note 備註
   - `hotel.checkout` → 顯示退房時間

2. **hotel.subs 格式統一**
   - Ray 的 4 處舊格式 `{label,text,location}` → 統一為 `{type:"parking",title,price,location,note}`
   - `renderHotel()` 改讀新格式（type/title/price/note/location）

3. **HuiYun subs 購物搬遷**
   - 6 處 `subs[type=shopping]` → 搬到 `hotel.infoBoxes[type=shopping]`
   - HuiYun 5 處 checkout 補齊

4. **移除無用 JSON 欄位**（四個行程檔）
   - `meta.themeColor` → 移除（HTML 寫死，從未讀取）
   - `meta.name` → 移除（trips.json 已有 name，trip JSON 內冗餘）

5. **資料一致性修正**
   - RayHus：3 處 hotel 補 checkout、1 處補 hotel.url
   - Ray：3 個餐廳補 category
   - Onion：15 處 hotel 無 checkout（板橋行程合理，不強制）

## Capabilities

### New Capabilities
（無新增）

### Modified Capabilities
- `trip-json-validation`：schema 驗證新增 hotel.subs 新格式結構檢查、移除 meta.themeColor/meta.name 驗證
- `trip-enrich-rules`：R7 飯店購物搬遷場景更新（subs → infoBoxes 完成後的驗證）

## Impact

- **JS**：`js/app.js` — `renderHotel()` 函式修改
- **JSON 資料**：4 個行程 JSON 批次修改（subs 格式統一、購物搬遷、欄位移除、缺漏補齊）
- **測試**：`tests/json/schema.test.js` 需更新 hotel.subs 結構驗證、移除 meta.themeColor/name 檢查
- **HTML/CSS**：無變更
- **checklist/backup/suggestions**：無連動影響（本次變更不改動天數結構）
