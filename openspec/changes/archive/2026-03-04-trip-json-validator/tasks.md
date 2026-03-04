## 1. 更新 rules-json-schema.md

- [x] 1.1 讀取所有 4 個行程 JSON，比對實際結構，全面重寫 `rules-json-schema.md` 對齊實際欄位（含根層級、day、hotel、timeline event、infoBox、flights、highlights、suggestions、checklist）
- [x] 1.2 在 hotel 定義中加入 `breakfast: { included: true|false|null, note: "可選" }` 和 `checkout: "可選"`（checkout 語意為飯店規定最晚退房時間，使用者安排的 checkin/out 在 timeline）
- [x] 1.3 從實際行程 JSON 萃取新版骨架，產出 `data/examples/template.json`（含所有必填/選填欄位的空殼結構，附註解說明）

## 2. 更新行程 JSON 檔案

- [x] 2.1 為所有 4 個行程 JSON 的每個 hotel 物件新增 `breakfast` 欄位（依已知資訊填 included/note，未知填 `null`）
- [x] 2.2 為所有 4 個行程 JSON 的每個 hotel 物件新增 `checkout` 欄位（查得到就填，查不到不加）
- [x] 2.3 精簡所有 4 個行程 JSON 的 `highlights.content.summary` 至 50 字以內風格評語（不列舉景點）

## 3. 擴充 Schema 驗證測試

- [x] 3.1 修改 `tests/json/schema.test.js`：動態掃描 `data/trips/` 所有 JSON 檔案（取代硬編碼 2 檔）
- [x] 3.2 新增根層級必填欄位測試（title、themeColor、days、weather、autoScrollDates、highlights、suggestions、checklist）
- [x] 3.3 新增每日結構測試（id、date、label、timeline）
- [x] 3.4 新增 hotel 結構測試（name 必填、breakfast 必填含 included、url/blogUrl/details/checkout/subs/infoBoxes 選填）
- [x] 3.5 新增 timeline event 結構測試（time + title 必填、選填欄位型別檢查）
- [x] 3.6 新增 transit 結構測試（text 字串 + type 字串）
- [x] 3.7 新增 restaurants infoBox 結構測試（name/hours/reservation 必填、選填欄位）
- [x] 3.8 新增 shopping infoBox 結構測試（category/name/hours/mustBuy 必填、選填欄位）
- [x] 3.9 新增 flights 結構測試（選填，存在時驗證 segments 含 label/route + time 或 depart/arrive）
- [x] 3.10 新增 highlights 結構測試（title + content.summary + content.tags）

## 4. 新增 Quality 驗證測試

- [x] 4.1 建立 `tests/json/quality.test.js`，動態掃描所有行程 JSON
- [x] 4.2 實作 R2 航程感知餐次檢查（解析 flights segments 時間，判斷首末日午晚餐需求，中間天正常檢查）
- [x] 4.3 實作 R2 一日遊團例外檢查（groupTour: true 的 event 所在日跳過午餐檢查）
- [x] 4.4 實作 R3 餐廳數量檢查（每個 restaurants infoBox ≥ 3 家）
- [x] 4.5 實作 R3 餐廳必填欄位檢查（hours、reservation 非空）
- [x] 4.6 實作 R3 營業時間吻合檢查（餐廳 hours 開始時間 ≤ event time）
- [x] 4.7 實作 R7 shopping mustBuy 檢查（每個 shop 的 mustBuy ≥ 3 項）
- [x] 4.8 實作 R7 shop 不含 titleUrl 檢查
- [x] 4.9 實作 R8 早餐欄位檢查（有 hotel 的日 breakfast 必須存在，included 為 true/false/null）
- [x] 4.10 實作 R9 AI 亮點字數檢查（summary ≤ 50 字，不含空白）
- [x] 4.11 實作 R9 不列舉景點檢查（summary 不含 "Day" 開頭列舉）

## 5. 設定 Claude Code Hook

- [x] 5.1 在 `.claude/settings.json` 新增 postToolCall hook：監聽 Edit/Write 對 `data/trips/*.json` 的修改，觸發 `npm test -- tests/json/`

## 6. 更新 Skill 規則

- [x] 6.1 在 `.claude/commands/render-trip.md` 新增 R8 早餐欄位規則
- [x] 6.2 在 `.claude/commands/render-trip.md` 新增 R9 AI 亮點精簡規則
- [x] 6.3 在 `.claude/commands/render-trip.md` 更新 R2 加入航程感知說明

## 7. 驗證

- [x] 7.1 執行 `npm test` 確認所有 4 個行程 JSON 通過 Schema + Quality 驗證
- [x] 7.2 確認 hook 設定正確（手動測試修改行程 JSON 後觸發驗證）
