## 1. search-strategies.md（Event Type Schema + 搜尋策略）

- [x] 1.1 建立 `.claude/commands/search-strategies.md` Part 1 — Event Type Schema：定義 Type A（景點）、Type B（交通）、Type C（餐廳）、Type D（航班）event 的必填/選填/禁填欄位清單，以及 Hotel、Shop 的必填欄位清單
- [x] 1.2 建立 `.claude/commands/search-strategies.md` Part 2 — Search Strategies：定義 googleRating / blogUrl / reservation / location 四種欄位的搜尋方式、關鍵字模板、驗證規則、適用 target
- [x] 1.3 更新 `.claude/commands/tp-create.md` Phase 1：加入「參照 search-strategies.md Event Type Schema 生成骨架」+ Phase 1 結尾「骨架完整性掃描」步驟

## 2. Hotel googleRating 渲染

- [x] 2.1 修改 `js/app.js` 的 `renderHotel()`：在飯店名稱（或連結）後、摺疊箭頭前加入 `<span class="rating">★ N.N</span>`（與餐廳/商店一致）
- [x] 2.2 更新 `tests/unit/render.test.js`：新增 hotel googleRating 渲染測試（有 rating 時顯示、無 rating 時不顯示）

## 3. Restaurant reservation 結構化

- [x] 3.1 修改 `js/app.js` 的 `renderRestaurant()`：從讀取 `reservation` 字串 + `reservationUrl` 改為讀取 `reservation` 物件（available/method/url/phone/recommended）
- [x] 3.2 修改 `js/app.js` 的 `URL_FIELDS`：移除 `reservationUrl`，改為驗證 `reservation.url`（遞迴檢查物件內的 URL）
- [x] 3.3 更新 `tests/unit/render.test.js`：更新 restaurant reservation 渲染測試（website/phone/no/unknown 四種情境 + recommended 組合）

## 4. 品質規則更新

- [x] 4.1 更新 `.claude/commands/trip-quality-rules.md`：R12 加入 hotel googleRating 檢查說明、R3 加入 reservation 結構化 strict 檢查說明
- [x] 4.2 更新 `tests/json/quality.test.js` R12：加入 hotel googleRating 檢查（hotel.name !== "家" 時必須有 1.0-5.0 的 googleRating）
- [x] 4.3 更新 `tests/json/quality.test.js` R3：加入 reservation 結構化檢查（available 枚舉、method 條件必填、url/phone 條件必填、recommended boolean）
- [x] 4.4 更新 `tests/json/schema.test.js`：reservation 型別從 string 改 object 驗證

## 5. 範本與文件更新

- [x] 5.1 更新 `data/examples/template.json`：hotel 加 googleRating 欄位、restaurant reservation 改為結構化物件範例
- [x] 5.2 更新 MEMORY.md 的 skill 對照表：加入 tp-patch

## 6. 行程 JSON 資料回填

- [x] 6.1 所有行程 JSON 的 hotel 補上 googleRating（用 Agent 並行搜尋各飯店的 Google 評分）
- [x] 6.2 所有行程 JSON 的 restaurant reservation 從字串轉為結構化物件（用 Agent 並行搜尋各餐廳的預約資訊）

## 7. tp-patch skill 建立

- [x] 7.1 建立 `.claude/commands/tp-patch.md`：定義結構化指令格式、掃描邏輯、Agent 並行策略、合併流程、備份與驗證流程
- [x] 7.2 更新 `.claude/commands/trip-quality-rules.md` 的 skill 引用列表：加入 tp-patch

## 8. 驗證

- [x] 8.1 執行 `npm test` 確認所有測試通過（render + schema + quality）
- [x] 8.2 對每個行程執行 tp-check 完整模式，確認 R0-R12 全綠
