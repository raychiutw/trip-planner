## Context

行程 JSON 由 AI（render-trip skill）產生或修改，目前只有 `tests/json/schema.test.js` 做基礎驗證（validateTripData + 日期格式），且只涵蓋 2/4 行程檔。`rules-json-schema.md` 嚴重過時（如 hotel 定義有 checkin/checkout 但實際 JSON 沒有）。品質規則 R1-R7 僅寫在 render-trip.md skill 裡，沒有自動化檢查。

## Goals / Non-Goals

**Goals:**
- 建立兩層驗證架構：Schema（欄位存在性） + Quality（R1-R9 值品質）
- Schema 層涵蓋所有 4 個行程 JSON
- Quality 層自動化 R1-R9 可機器檢查的部分
- Claude Code hook 在每次修改行程 JSON 後自動觸發驗證
- 更新 `rules-json-schema.md` 對齊實際 JSON 結構
- 新增 R8（早餐）、R9（AI 亮點）規則到 render-trip skill

**Non-Goals:**
- 不驗證 blogUrl/titleUrl 的可達性（需網路請求）
- 不驗證餐廳推薦的「品質」（如是否真的評價高）
- 不在 UI 端顯示驗證結果（純 CLI/測試層）
- 不改 app.js 的 validateTripData 函式（那是前端驗證）

## Decisions

### D1：驗證分測試檔 vs 獨立 CLI 工具
**選擇**：Vitest 測試檔（`tests/json/quality.test.js`）
**理由**：專案已有 Vitest + pre-commit hook 架構，新增測試檔即可自動整合，不需額外 CLI 工具。hook 呼叫 `npm test` 即可。

### D2：Schema 層實作位置
**選擇**：擴充現有 `tests/json/schema.test.js`
**理由**：不拆新檔，在既有測試結構內加入所有 4 個行程檔 + 新增欄位檢查（breakfast、checkout）。

### D3：Flight time 解析策略
**選擇**：同時支援兩種格式
- 結構化：`segments[].depart` / `segments[].arrive`（schema 定義）
- 合併字串：`segments[].time` 如 `"3/6（五）15:20→17:50"`（實際 JSON）
**理由**：現有 JSON 用合併字串，但 schema 定義結構化格式。驗證器兩種都認，才能支援新舊格式。

### D4：Claude Code Hook 類型
**選擇**：`.claude/settings.json` 的 `hooks.postToolCall`
**配置**：監聽 Edit/Write tool 對 `data/trips/*.json` 的修改，觸發 `npm test -- tests/json/`
**失敗行為**：hook 回傳非 0 exit code → Claude Code 停下來，不繼續修改

### D5：R2 航程判斷的時間切點
- 午餐切點：11:30（到達 < 11:30 → 需要午餐）
- 晚餐切點：17:00（到達 < 17:00 → 需要晚餐）
- 出發日用出發時間而非到達時間判斷

### D6：breakfast 與 checkout 欄位
**選擇**：`days[].hotel.breakfast` + `days[].hotel.checkout`（在 hotel 物件內）
**理由**：早餐與飯店強關聯，放在 hotel 物件內最直覺。
**breakfast 結構**：`{ included: true|false|null, note: "可選說明" }`
**checkout 語意**：飯店規定的「最晚退房時間」（如 `"11:00"`），選填。使用者實際安排的 checkin/checkout 時間已在 timeline events 中（如 `"09:00 退房 Living Inn"`、`"15:00 Check in NEST"`），hotel 物件不重複記錄。

### D7：R9 字數計算方式
**選擇**：計算中文字元數（含標點），不含空白
**理由**：50 字限制是對中文內容的限制，英文字母和數字也各算一字

### D8：Template JSON 位置
**選擇**：`data/examples/template.json`
**理由**：與實際行程資料 `data/trips/` 分離，語意清楚（「範例」資料夾）。驗證器只掃 `data/trips/*.json`，不需額外排除邏輯。render-trip skill 參考時路徑直覺。

## Risks / Trade-offs

- **[現有 JSON 不合規]** → 更新所有 4 個行程 JSON 補齊 breakfast/checkout 欄位，精簡 highlights summary
- **[Flight time 格式不一致]** → 驗證器雙格式支援，長期應統一為結構化格式
- **[Hook 減慢開發速度]** → 只在 `data/trips/*.json` 修改時觸發，其他檔案不受影響
- **[R2 時間判斷邊界]** → 用 11:30/17:00 作為午晚餐切點，可能不完全精確但足夠合理
