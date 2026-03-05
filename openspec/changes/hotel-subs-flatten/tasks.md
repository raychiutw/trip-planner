## Tasks

### 1. 資料遷移

- [x] 1.1 將 `okinawa-trip-2026-Ray.json` 中所有 `hotel.subs[]` 的 parking 條目（共 4 筆）移入對應飯店的 `hotel.infoBoxes[]`，並刪除 `subs` 欄位
- [x] 1.2 將 `okinawa-trip-2026-HuiYun.json` 中所有 `hotel.subs[]` 的 parking 條目（共 6 筆）移入對應飯店的 `hotel.infoBoxes[]`，並刪除 `subs` 欄位

### 2. 渲染更新

- [x] 2.1 在 `js/app.js` 的 `renderInfoBox case 'parking'`（第 122–128 行）於 `price` 之後、`location` 之前加入：`if (box.note) html += '（' + escHtml(box.note) + '）';`
- [x] 2.2 從 `js/app.js` 的 `renderHotel` 函式移除 subs 迴圈（第 268–276 行，即 `if (hotel.subs && hotel.subs.length)` 整個區塊）

### 3. Schema 測試更新

- [x] 3.1 從 `tests/json/schema.test.js` 移除所有 `hotel.subs` 相關驗證（選填欄位列舉中的 `subs`）
- [x] 3.2 在 `tests/json/schema.test.js` 的 parking infoBox 驗證中新增 `note` 為選填字串欄位的測試案例

### 4. 規格文件同步

- [x] 4.1 更新 `rules-json-schema.md` 的 Hotel 物件定義，移除 `subs` 欄位說明，確保文件與實際 JSON 結構一致

### 5. 驗證

- [x] 5.1 執行 `npm test`，確認所有測試通過
