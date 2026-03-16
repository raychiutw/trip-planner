---
name: tp-request
description: Use when the user wants to process open requests submitted by travel companions via the D1 API and apply or respond to each request.
user-invocable: true
---

處理旅伴送出的行程請求（D1 database），依 mode 與意圖分流處理。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## API 設定

- **Base URL**: `https://trip-planner-dby.pages.dev`
- **認證**: Service Token headers
  - `CF-Access-Client-Id`: 從環境變數 `CF_ACCESS_CLIENT_ID` 取得
  - `CF-Access-Client-Secret`: 從環境變數 `CF_ACCESS_CLIENT_SECRET` 取得

## 步驟

1. `git pull origin master`
2. 取得所有 open 請求：
   ```bash
   curl -s -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
        -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
        "https://trip-planner-dby.pages.dev/api/requests?status=open"
   ```
3. 無 open 請求 → 回報「沒有待處理的請求」並結束
4. 依序處理每個請求：

### 4a. 解析 metadata

- **mode**：`request.mode`（`trip-edit` 或 `trip-plan`）
- **tripId**：`request.trip_id`
- **owner**：`tripId.split('-').pop()`
- **timestamp**：`request.created_at`
- **text**：`request.body`
- **requestId**：`request.id`

### 4b. 意圖安全矩陣

依 mode + intent 分流：

| mode | intent | 處理方式 |
|------|--------|----------|
| trip-edit | 修改 | 修改 MD → commit → deploy（見步驟 4c） |
| trip-edit | 諮詢 | 回覆請求，不修改檔案 |
| trip-plan | 諮詢 | 回覆請求，不修改檔案 |
| trip-plan | 修改 | 回覆建議以 trip-edit 重新送出 |

- **intent 判斷**：依 text 內容判斷是「修改」（要求新增/刪除/替換行程內容）還是「諮詢」（詢問建議/比較/確認）

### 4c. 修改流程（trip-edit + intent=修改）

   a. 讀取 `data/trips-md/{tripId}/` 下的 MD 檔案
   b. 依請求 text 內容**局部修改**對應的 MD 檔案（只改 text 描述的部分，不全面重跑 R0-R15）
   c. 新增或替換的 POI 須包含以下必填欄位：
      - `source`：使用者明確指定名稱（如「換成一蘭拉麵」）→ `"user"`；僅給模糊描述（如「換成拉麵店」）→ `"ai"`
      - `note`：有備註填內容，無備註填空字串 `""`（R15）
      - `maps`：實體地點填搜尋文字（R11）
      - `rating`：Google 評分 1.0-5.0（R12，`source: "ai"` 必填，`source: "user"` 盡量填）
   d. 修改的部分須符合 R0-R15 品質規則
   d2. 韓國行程（`meta.countries` 含 `"KR"`）新增或修改 POI 時，須為 location 新增 `naverQuery`（R14）
   e. 若影響到 checklist、backup、suggestions，同步更新對應 MD 檔案
   f. 若插入、移除或移動 entry，重新估算相鄰 travel 的 type + 分鐘數
   g. 執行 `npm run build` 更新 dist
   h. 執行 `git diff --name-only`：
      → 只有 `data/trips-md/{tripId}/**` + `data/dist/**` → OK
      → 有其他檔案被改 → `git checkout` 還原非白名單檔案
   i. `npm test`
   j. **tp-check 精簡 report**：輸出 `tp-check: 🟢 N  🟡 N  🔴 N`
   k. 通過 → commit push + 回覆關閉請求：
      ```bash
      curl -s -X PATCH \
        -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
        -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
        -H "Content-Type: application/json" \
        -d '{"reply":"✅ 已處理：{摘要}","status":"closed"}' \
        "https://trip-planner-dby.pages.dev/api/requests/{requestId}"
      ```
   l. 失敗 → `git checkout -- data/trips-md/{tripId}/` + 回覆關閉：
      ```bash
      curl -s -X PATCH \
        -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
        -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
        -H "Content-Type: application/json" \
        -d '{"reply":"❌ 處理失敗：{錯誤}","status":"closed"}' \
        "https://trip-planner-dby.pages.dev/api/requests/{requestId}"
      ```

### 4d. 諮詢回覆流程

回覆後關閉請求：
```bash
curl -s -X PATCH \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"reply":"{回覆內容}","status":"closed"}' \
  "https://trip-planner-dby.pages.dev/api/requests/{requestId}"
```

## 局部修改 vs 全面重整

本 skill 只處理請求 text 描述的修改範圍。**不全面重跑 R0-R15**。如需全面重整，使用 `/tp-rebuild`。

僅允許編輯：
  data/trips-md/{tripId}/**

以下為 build 產物，由 npm run build 自動產生，嚴禁手動編輯：
  data/dist/**
