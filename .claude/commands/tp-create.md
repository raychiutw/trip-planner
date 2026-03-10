從零產生符合品質規則的完整行程 MD 檔案群。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion（料理偏好除外）。

## 輸入方式

- 指定描述：`/tp-create 沖繩五日自駕`
- 未指定：詢問行程目的地、天數、旅行方式等基本資訊

## 步驟（兩階段生成）

### Phase 1：產生骨架

1. 詢問使用者料理偏好（最多 3 類，依優先排序），寫入 `meta.foodPreferences`
1b. 依目的地自動判斷 `meta.countries`（ISO 3166-1 alpha-2 國碼陣列）：日本 `["JP"]`、韓國 `["KR"]`、台灣 `["TW"]` 等。韓國行程須為所有 POI location 新增 `naverQuery`（Naver Maps URL）
2. 讀取 `trip-quality-rules.md` 中定義的所有品質規則
3. 讀取 `data/examples/` 下的 MD 範例檔作為格式參考
4. 以範例格式為基礎，依使用者描述產生 MD 檔案群：
   - `data/trips-md/{tripId}/meta.md`（含 name、owner、title 等 frontmatter + Footer section）
   - `data/trips-md/{tripId}/day-N.md`（每日一檔）
   - `data/trips-md/{tripId}/flights.md`（若有航班）
   - `data/trips-md/{tripId}/checklist.md`
   - `data/trips-md/{tripId}/backup.md`
   - `data/trips-md/{tripId}/suggestions.md`
   - `data/trips-md/{tripId}/emergency.md`（若有）
5. 每天 hotel 須包含 `checkout` 欄位（從 details 退房時間提取，查不到則為空字串 `""`）
6. 骨架中尚無法確認的欄位**留空**（不使用 null）：
   - googleRating → 不放（省略欄位）
7. 所有 POI 標記 `"source": "ai"`（tp-create 產生的行程全部由 AI 推薦）
8. 參考現有 `data/trips-md/` 下的行程 MD 格式撰寫

### Phase 2：並行充填（Agent teams）

9. 對每一天啟動一個 Agent（sonnet），並行執行：
   - 用 WebSearch 查詢缺少 googleRating 的地點/餐廳評分
   - Agent 直接修改對應的 `data/trips-md/{tripId}/day-N.md` 補充資訊
10. 收集所有 Agent 完成後確認 MD 檔案完整
11. 確保不引入 null 值（找不到 → googleRating 省略）

### Phase 3：驗證

12. 執行 `npm run build` 產生 dist（含自動產生 `data/dist/trips.json`）
13. 執行 `git diff --name-only`：
    → 只有 `data/trips-md/{tripId}/**` + `data/dist/**` → OK
    → 有其他檔案被改 → `git checkout` 還原非白名單檔案
14. `npm test`
15. 執行 `/tp-check` 完整模式驗證
16. 不自動 commit（由使用者決定）

## tripId 命名規則

`{destination}-trip-{year}-{owner}`，例如：`okinawa-trip-2026-Ray`

僅允許編輯：
  data/trips-md/{tripId}/**

以下為 build 產物，由 npm run build 自動產生，嚴禁手動編輯：
  data/dist/**

## 品質規則

完整品質規則定義在 `trip-quality-rules.md`。本 skill 產生的行程須符合其中所有規則。
