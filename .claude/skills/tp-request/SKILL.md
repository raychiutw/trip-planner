---
name: tp-request
description: Use when the user wants to process open requests submitted by travel companions via the D1 API and apply or respond to each request.
user-invocable: true
---

處理旅伴送出的行程請求（D1 database），依 mode 與意圖分流處理。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## API 設定

- **Base URL**: `https://trip-planner-dby.pages.dev`
- **認證**: Service Token headers（寫入操作必填）
  - `CF-Access-Client-Id`: `e5902a9d6f5181b8f70e12f1c11ebca3.access`
  - `CF-Access-Client-Secret`: `9c7d873d558eaf65cdc4160f9ec8f0c06d4f387fc069c7a7e1add0b8196b43a8`

## 觸發模式

本 skill 有兩種觸發方式：
1. **即時（webhook）**：旅伴送出請求 → Pages Function 透過 Tunnel 呼叫本機 Agent Server → 即時處理
2. **排程 fallback**：Windows Task Scheduler 定期執行本 skill，只處理 webhook 失敗的請求

## 步驟

1. **判斷處理範圍**：
   - 使用者 prompt 包含「全部」、「所有」、「all」→ 查所有 open 請求
   - 否則（預設）→ **只查 webhook 失敗的請求**：
   ```bash
   curl -s -H "CF-Access-Client-Id: e5902a9d6f5181b8f70e12f1c11ebca3.access" \
        -H "CF-Access-Client-Secret: 9c7d873d558eaf65cdc4160f9ec8f0c06d4f387fc069c7a7e1add0b8196b43a8" \
        "https://trip-planner-dby.pages.dev/api/requests?status=open&webhook_failed=1"
   ```
   若使用者要求處理全部：
   ```bash
   curl -s -H "CF-Access-Client-Id: e5902a9d6f5181b8f70e12f1c11ebca3.access" \
        -H "CF-Access-Client-Secret: 9c7d873d558eaf65cdc4160f9ec8f0c06d4f387fc069c7a7e1add0b8196b43a8" \
        "https://trip-planner-dby.pages.dev/api/requests?status=open"
   ```
2. 無符合條件的請求 → 回報「沒有待處理的請求」並結束
3. 依序處理每個請求：

### 3a. 解析 metadata

- **mode**：`request.mode`（`trip-edit` 或 `trip-plan`）
- **tripId**：`request.trip_id`
- **owner**：`tripId.split('-').pop()`
- **timestamp**：`request.created_at`
- **text**：`request.body`
- **requestId**：`request.id`

### 3b. 意圖安全矩陣

依 mode + intent 分流：

| mode | intent | 處理方式 |
|------|--------|----------|
| trip-edit | 修改 | 讀取 API 資料 → 修改 → 寫回 API（見步驟 3c） |
| trip-edit | 諮詢 | 回覆請求，不修改資料 |
| trip-plan | 諮詢 | 回覆請求，不修改資料 |
| trip-plan | 修改 | 回覆建議以 trip-edit 重新送出 |

- **intent 判斷**：依 text 內容判斷是「修改」（要求新增/刪除/替換行程內容）還是「諮詢」（詢問建議/比較/確認）

### 3c. 修改流程（trip-edit + intent=修改）

   a. 讀取行程資料：
      ```bash
      # 讀取 meta
      curl -s "https://trip-planner-dby.pages.dev/api/trips/{tripId}"
      # 讀取受影響的天（依請求內容判斷）
      curl -s "https://trip-planner-dby.pages.dev/api/trips/{tripId}/days/{dayNum}"
      ```
   b. 依請求 text 內容**局部修改**對應資料（只改 text 描述的部分，不全面重跑 R0-R15）
   c. 新增或替換的 POI 須包含以下必填欄位：
      - `source`：使用者明確指定名稱（如「換成一蘭拉麵」）→ `"user"`；僅給模糊描述（如「換成拉麵店」）→ `"ai"`
      - `note`：有備註填內容，無備註填空字串 `""`（R15）
      - `location.googleQuery`：實體地點填搜尋文字（R11）
      - `googleRating`：Google 評分 1.0-5.0（R12，`source: "ai"` 必填，`source: "user"` 盡量填）
   d. 修改的部分須符合 R0-R15 品質規則
   d2. 韓國行程（`meta.countries` 含 `"KR"`）新增或修改 POI 時，須為 location 新增 `naverQuery`（R14）
   e. 依修改類型選擇對應 API：
      - **修改單一 entry**（title/time/description/location/travel 等）：
        ```bash
        curl -s -X PATCH \
          -H "CF-Access-Client-Id: e5902a9d6f5181b8f70e12f1c11ebca3.access" \
          -H "CF-Access-Client-Secret: 9c7d873d558eaf65cdc4160f9ec8f0c06d4f387fc069c7a7e1add0b8196b43a8" \
          -H "Content-Type: application/json" \
          -d '{...修改欄位...}' \
          "https://trip-planner-dby.pages.dev/api/trips/{tripId}/entries/{eid}"
        ```
      - **覆寫整天**（插入/移除/重排 entry，或整天大幅修改）：
        ```bash
        curl -s -X PUT \
          -H "CF-Access-Client-Id: e5902a9d6f5181b8f70e12f1c11ebca3.access" \
          -H "CF-Access-Client-Secret: 9c7d873d558eaf65cdc4160f9ec8f0c06d4f387fc069c7a7e1add0b8196b43a8" \
          -H "Content-Type: application/json" \
          -d '{...完整一天資料...}' \
          "https://trip-planner-dby.pages.dev/api/trips/{tripId}/days/{dayNum}"
        ```
      - **新增餐廳**：POST `/api/trips/{tripId}/entries/{eid}/restaurants`
      - **修改/刪除餐廳**：PATCH/DELETE `/api/trips/{tripId}/restaurants/{rid}`
      - **新增購物（entry 下）**：POST `/api/trips/{tripId}/entries/{eid}/shopping`
      - **修改/刪除購物**：PATCH/DELETE `/api/trips/{tripId}/shopping/{sid}`
      - **更新 doc**（checklist/backup/suggestions 等）：
        ```bash
        curl -s -X PUT \
          -H "CF-Access-Client-Id: e5902a9d6f5181b8f70e12f1c11ebca3.access" \
          -H "CF-Access-Client-Secret: 9c7d873d558eaf65cdc4160f9ec8f0c06d4f387fc069c7a7e1add0b8196b43a8" \
          -H "Content-Type: application/json" \
          -d '{"content":"..."}' \
          "https://trip-planner-dby.pages.dev/api/trips/{tripId}/docs/{type}"
        ```
   f. 若插入、移除或移動 entry，重新估算相鄰 travel 的 type + 分鐘數並更新
   g. 執行 tp-check 精簡 report：輸出 `tp-check: 🟢 N  🟡 N  🔴 N`
   h. 通過 → 回覆並關閉請求（見下方「回覆寫入方法」）
   i. 失敗 → 回覆並關閉（見下方「回覆寫入方法」）

### 3d. 諮詢回覆流程

回覆後關閉請求（見下方「回覆寫入方法」）

### 回覆寫入方法

⚠️ **不要把中文直接放在 curl `-d` 引號中**，Windows shell CP950 會破壞 UTF-8 編碼。
改用 Node.js 寫暫存檔 + `curl --data @file`：

```bash
node -e "require('fs').writeFileSync('/tmp/reply.json', JSON.stringify({reply:'回覆內容', status:'closed', processed_by:'scheduler'}), 'utf8')"
curl -s -X PATCH \
  -H "CF-Access-Client-Id: e5902a9d6f5181b8f70e12f1c11ebca3.access" \
  -H "CF-Access-Client-Secret: 9c7d873d558eaf65cdc4160f9ec8f0c06d4f387fc069c7a7e1add0b8196b43a8" \
  -H "Content-Type: application/json" \
  --data @/tmp/reply.json \
  "https://trip-planner-dby.pages.dev/api/requests/{requestId}"
```

## 局部修改 vs 全面重整

本 skill 只處理請求 text 描述的修改範圍。**不全面重跑 R0-R15**。如需全面重整，使用 `/tp-rebuild`。

## 注意事項

- 所有資料讀寫均透過 API，不操作本地 MD 檔案
- 不執行 git commit / push（資料已直接寫入 D1 database）
- 不執行 npm run build（無 dist 產物需產生）
