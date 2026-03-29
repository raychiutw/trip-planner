---
name: tp-request
description: Use when the user wants to process open requests submitted by travel companions via the D1 API and apply or respond to each request.
user-invocable: true
---

處理旅伴送出的行程請求（D1 database），依 mode 與意圖分流處理。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## API 設定

API 設定、curl 模板、Windows encoding 注意事項見 tp-shared/references.md

## 觸發模式

Windows Task Scheduler 每分鐘排程執行本 skill，處理所有 open/received 請求。

## 四態 Status 流程

```
排程撈到 open 請求 → PATCH status=received（排程負責）
→ 啟動 Claude tp-request → PATCH status=processing（skill 負責）
→ 處理完成 → PATCH status=completed + reply（skill 負責）
```

## 步驟

1. **查詢待處理請求**（open 或 received）：
   ```bash
   curl -s -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
        -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
        "https://trip-planner-dby.pages.dev/api/requests?status=received"
   ```
   若無結果，也查 `status=open`（防排程未更新的情況）
2. 無待處理請求 → 回報「沒有待處理的請求」並結束
3. 依序處理每個請求：

### 3a. 更新 status → processing

處理每個請求前，先 PATCH status 為 `processing`：
```bash
node -e "require('fs').writeFileSync('/tmp/status.json', JSON.stringify({status:'processing'}), 'utf8')"
curl -s -X PATCH \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  -H "Content-Type: application/json" \
  --data @/tmp/status.json \
  "https://trip-planner-dby.pages.dev/api/requests/{requestId}"
```

### 3b. 解析 metadata

- **mode**：`request.mode`（`trip-edit` = 改行程、`trip-plan` = 問建議）
- **tripId**：`request.trip_id`
- **owner**：`tripId.split('-').pop()`
- **timestamp**：`request.created_at`
- **text**：`request.message`
- **requestId**：`request.id`

### 3c. 意圖安全矩陣

依 mode + intent 分流：

| mode | intent | 處理方式 |
|------|--------|----------|
| trip-edit（改行程） | 修改 | 讀取 API 資料 → 修改 → 寫回 API（見步驟 3d） |
| trip-edit（改行程） | 諮詢 | 回覆請求，不修改資料 |
| trip-plan（問建議） | 諮詢 | 回覆請求，不修改資料 |
| trip-plan（問建議） | 修改 | 回覆建議以**改行程**重新送出 |

- **intent 判斷**：依 text 內容判斷是「修改」（要求新增/刪除/替換行程內容）還是「諮詢」（詢問建議/比較/確認）
- **回覆中文化**：回覆內文中使用「改行程」和「問建議」，不得出現英文 mode 值（`trip-edit` / `trip-plan`）

### 3d. 修改流程（改行程 + intent=修改）

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
        googleRating 查詢策略見 tp-shared/references.md（優先 /browse Google Maps）
   d. 修改的部分須符合 R0-R18 品質規則（含 R16 飯店 rating、R17 導航資訊、R18 飯店 address）
   d2. 韓國行程（`meta.countries` 含 `"KR"`）新增或修改 POI 時，須為 location 新增 `naverQuery`（R14）
   e. 依修改類型選擇對應 API：
      - **修改單一 entry**（title/time/description/location/travel 等）：
        ```bash
        curl -s -X PATCH \
          -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
          -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
          -H "Content-Type: application/json" \
          -d '{...修改欄位...}' \
          "https://trip-planner-dby.pages.dev/api/trips/{tripId}/entries/{eid}"
        ```
      - **覆寫整天**（插入/移除/重排 entry，或整天大幅修改）：
        ```bash
        curl -s -X PUT \
          -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
          -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
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
          -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
          -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
          -H "Content-Type: application/json" \
          -d '{"content":"..."}' \
          "https://trip-planner-dby.pages.dev/api/trips/{tripId}/docs/{type}"
        ```
   f. 若插入、移除或移動 entry，重新估算相鄰 travel 的 type + 分鐘數並更新
   g. 執行 tp-check 精簡 report：輸出 `tp-check: 🟢 N  🟡 N  🔴 N`
   h. 通過 → 回覆並完成請求（見下方「回覆寫入方法」）
   i. 失敗 → 回覆並完成（見下方「回覆寫入方法」）

### 3e. 諮詢回覆流程

回覆後完成請求（見下方「回覆寫入方法」）

### 回覆寫入方法

```bash
node -e "require('fs').writeFileSync('/tmp/reply.json', JSON.stringify({reply:'回覆內容', status:'completed', processed_by:'scheduler'}), 'utf8')"
curl -s -X PATCH \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  -H "Content-Type: application/json" \
  --data @/tmp/reply.json \
  "https://trip-planner-dby.pages.dev/api/requests/{requestId}"
```

## 局部修改 vs 全面重整

本 skill 只處理請求 text 描述的修改範圍。**不全面重跑 R0-R15**。如需全面重整，使用 `/tp-rebuild`。

## Markdown 支援欄位

Markdown 支援欄位見 tp-shared/references.md

## 注意事項

- 所有資料讀寫均透過 API，不操作本地 MD 檔案
- 不執行 git commit / push（資料已直接寫入 D1 database）
- 不執行 npm run build（無 dist 產物需產生）
