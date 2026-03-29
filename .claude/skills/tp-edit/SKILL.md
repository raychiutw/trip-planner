---
name: tp-edit
description: Use when the user describes a partial change to an existing trip itinerary in natural language (e.g., swap a restaurant, add a stop to a specific day).
user-invocable: true
---

接受自然語言描述，局部修改指定行程資料（D1 API）。修改後執行 tp-check 精簡 report。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## API 設定

API 設定、curl 模板、Windows encoding 注意事項見 tp-shared/references.md

## 輸入方式

- 指定 tripId + 描述：`/tp-edit okinawa-trip-2026-Ray Day 3 午餐換成拉麵`
- 未指定 tripId：呼叫 `GET /api/trips` 列出所有行程供選擇

## 步驟

1. 讀取行程資料：
   ```bash
   # 讀取 meta（取得基本資訊、countries 等）
   curl -s "https://trip-planner-dby.pages.dev/api/trips/{tripId}"
   # 讀取受影響的天
   curl -s "https://trip-planner-dby.pages.dev/api/trips/{tripId}/days/{dayNum}"
   ```
2. 依自然語言描述**局部修改**對應資料（只改描述涉及的部分）
3. 新增或替換的 POI 須包含以下必填欄位：
   - `source`：使用者明確指定名稱（如「換成一蘭拉麵」）→ `"user"`；僅給模糊描述（如「換成拉麵店」）→ `"ai"`
   - `note`：有備註填內容，無備註填空字串 `""`（R15）
   - `location.googleQuery`：實體地點填搜尋文字（R11）
   - `googleRating`：Google 評分 1.0-5.0（R12，`source: "ai"` 必填，`source: "user"` 盡量填）
     googleRating 查詢策略見 tp-shared/references.md（優先 /browse Google Maps）
   - **POI V2 欄位規格**（同 tp-create）：
     POI V2 各 type 必填/建議欄位見 tp-shared/references.md
4. 修改的部分須符合 R0-R15 品質規則
4b. 韓國行程（`meta.countries` 含 `"KR"`）新增或修改 POI 時，須為 location 新增 `naverQuery`（Naver Maps URL，優先精確 place URL，查不到時用搜尋式 URL `https://map.naver.com/v5/search/{韓文關鍵字}`）
5. 依修改類型選擇對應 API：
   - **修改單一 entry**（title/time/description/location/travel 等）：
     `PATCH /api/trips/{tripId}/entries/{eid}` + JSON body（curl 模板見 tp-shared/references.md）
   - **覆寫整天**（插入/移除/重排 entry，或整天大幅修改）：
     `PUT /api/trips/{tripId}/days/{dayNum}` + JSON body

   **注意**：覆寫整天（PUT）時，必須保留原始的 `date`、`dayOfWeek`、`label`，不得送出 null。缺少任一欄位 API 將回傳 400。
   - **新增餐廳**：POST `/api/trips/{tripId}/entries/{eid}/restaurants`
   - **修改/刪除餐廳**：PATCH/DELETE `/api/trips/{tripId}/restaurants/{rid}`
   - **新增購物（entry 下）**：POST `/api/trips/{tripId}/entries/{eid}/shopping`
   - **修改/刪除購物**：PATCH/DELETE `/api/trips/{tripId}/shopping/{sid}`
   - **更新 doc**（checklist/backup/suggestions 等）：
     `PUT /api/trips/{tripId}/docs/{type}` + JSON body
6. 若影響到 checklist、backup、suggestions，同步更新對應 doc
7. 若插入、移除或移動 entry，重新估算相鄰 travel 的 type + 分鐘數並更新
8. 執行 tp-check 精簡模式，輸出：`tp-check: 🟢 N  🟡 N  🔴 N`
9. 不自動 commit（資料已直接寫入 D1 database，無需 git 操作）

## 局部修改 vs 全面重整

本 skill 只處理描述涉及的修改範圍，例如：
- 「Day 3 午餐換成拉麵」→ 只改 Day 3 午餐 entry
- 「加一個景點到 Day 2」→ 只在 Day 2 timeline 插入
- 「刪除 Day 4 的購物行程」→ 只移除該 entry

**不全面重跑 R0-R15**。如需全面重整，使用 `/tp-rebuild`。

## 注意事項

- 所有資料讀寫均透過 API，不操作本地 MD 檔案
- 不執行 git commit / push（資料已直接寫入 D1 database）
- 不執行 npm run build（無 dist 產物需產生）

## Markdown 支援欄位

Markdown 支援欄位見 tp-shared/references.md
