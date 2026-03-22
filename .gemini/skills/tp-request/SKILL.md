---
name: tp-request
description: 處理旅伴送出的行程請求（D1 API），依 mode 與意圖分流處理。適用於自動化處理來自 D1 database 的行程修改或諮詢請求。
---

# tp-request

處理旅伴送出的行程請求（D1 database），依 mode 與意圖分流處理。

## API 設定

- **Base URL**: `https://trip-planner-dby.pages.dev`
- **認證**: Service Token headers（寫入操作必填）
  - `CF-Access-Client-Id`: `$CF_ACCESS_CLIENT_ID`
  - `CF-Access-Client-Secret`: 從環境變數 `CF_ACCESS_CLIENT_SECRET` 取得（值：`$CF_ACCESS_CLIENT_SECRET`）

## 步驟

1. **取得 open 請求**：
   ```bash
   curl -s -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
        -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
        "https://trip-planner-dby.pages.dev/api/requests?status=open"
   ```
2. 無 open 請求 → 回報「沒有待處理的請求」並結束
3. **逐一處理**：
   - **解析 Metadata**：取得 `mode`, `trip_id`, `body`, `id`。`owner` = `trip_id.split('-').pop()`。
   - **判斷意圖**：區分「修改」或「諮詢」。
   - **分流處理**：
     - **諮詢**：回覆並關閉請求，不改資料。
     - **修改** (trip-edit)：
       a. 讀取行程資料：GET `/api/trips/{tripId}` + GET `/api/trips/{tripId}/days/{N}`
       b. 依描述局部修改（標記 `source: "user"` 或 `"ai"`）
       c. 符合 `references/trip-quality-rules.md`
       d. 依修改類型選擇 API：PATCH entries、PUT days、PATCH/POST restaurants/shopping、PUT docs
       e. 執行 tp-check（精簡模式）
       f. 回覆並關閉請求
     - **修改** (trip-plan)：回覆建議改以 `trip-edit` 送出。

4. **回覆並關閉請求**：
   ```bash
   curl -s -X PATCH \
     -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"reply":"{回覆內容}","status":"closed"}' \
     "https://trip-planner-dby.pages.dev/api/requests/{requestId}"
   ```

## 注意事項

- 所有資料讀寫均透過 API，不操作本地 MD 檔案
- 不執行 git commit / push（資料已直接寫入 D1 database）
- 不執行 npm run build（無 dist 產物需產生）

## 參考資源
- 品質規則：`references/trip-quality-rules.md`
