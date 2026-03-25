---
name: tp-create
description: Use when the user wants to generate a complete new trip itinerary from scratch given a destination, duration, and travel style.
user-invocable: true
---

從零產生符合品質規則的完整行程，透過 D1 API 建立資料。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion（料理偏好除外）。

## API 設定

- **Base URL**: `https://trip-planner-dby.pages.dev`
- **認證**: Service Token headers（寫入操作必填）
  - `CF-Access-Client-Id`: `$CF_ACCESS_CLIENT_ID`
  - `CF-Access-Client-Secret`: `$CF_ACCESS_CLIENT_SECRET`

## 輸入方式

- 指定描述：`/tp-create 沖繩五日自駕`
- 未指定：詢問行程目的地、天數、旅行方式等基本資訊

## 步驟（兩階段生成）

### Phase 1：產生骨架

1. 詢問使用者料理偏好（最多 3 類，依優先排序），寫入 `meta.foodPreferences`
1b. 依目的地自動判斷 `meta.countries`（ISO 3166-1 alpha-2 國碼陣列）：日本 `["JP"]`、韓國 `["KR"]`、台灣 `["TW"]` 等。韓國行程須為所有 POI location 新增 `naverQuery`（Naver Maps URL）
2. 讀取品質規則（tp-quality-rules skill）
3. 建立行程 meta：

   > ⚠️ Windows encoding 注意：curl -d 中的中文在 Windows shell 會變亂碼，一律用 node writeFileSync + --data @file

   ```bash
   node -e "require('fs').writeFileSync('/tmp/meta.json', JSON.stringify({id:'{tripId}', name:'{owner}', title:'{行程標題}', startDate:'{YYYY-MM-DD}', endDate:'{YYYY-MM-DD}', countries:['{ISO碼}'], transportMode:'car|transit', foodPreferences:['{偏好1}','{偏好2}'], published:false}), 'utf8')"
   curl -s -X POST \
     -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     -H "Content-Type: application/json" \
     --data @/tmp/meta.json \
     "https://trip-planner-dby.pages.dev/api/trips"
   ```
4. 為每一天產生完整內容（JSON 格式），包含：
   - timeline entries（含 type、title、time、description、location、travel、hotels 等）
   - restaurants infoBox（午餐/晚餐 entry 下各 3 家推薦）
   - shopping infoBox（非家飯店 entry 下）
   - 每個 POI 須包含以下必填欄位：
     - `source: "ai"`（tp-create 產生的行程全部由 AI 推薦）
     - `note: ""`（有備註填內容，無備註填空字串，R15）
     - `googleRating`：Phase 1 先省略，Phase 2 並行查詢補充（R12）
     - `location`：實體地點必須包含完整結構（R11）：
       ```json
       {
         "name": "原文地名（日文/韓文/中文）",
         "googleQuery": "https://www.google.com/maps/search/{percent-encoded}",
         "appleQuery": "https://maps.apple.com/?q={percent-encoded}",
         "lat": 26.2109, "lng": 127.6820,
         "geocode_status": "review"
       }
       ```
     - **JP 自駕行程**（`selfDrive`）：entry 層級補 `mapcode`（格式 `"XXX XXX XXX*XX"`，WebSearch 查詢；查不到時省略）
     - **KR 行程**：`location.naverQuery` 必填（Naver Maps URL，R14；優先 place URL，查不到用搜尋式 URL）
   - Markdown 支援欄位（前端會渲染 markdown）：
     - `entry.body`（description）：✅ 可用粗體、列表、連結
     - `entry.note`：✅ 可用粗體、列表
     - `restaurant.description`：✅ 可用 markdown
     - `entry.title` / `restaurant.name` / `hotel.name`：❌ 純文字
5. 每天 hotel 須包含 `checkout` 欄位（從 details 退房時間提取，查不到則為空字串 `""`）
6. 骨架中尚無法確認的欄位**留空**（不使用 null）：`googleRating` 省略欄位，其餘欄位用空字串
7. 依序建立每天資料：

   每天 PUT 的 request body **必須**包含以下三個欄位，缺少任一欄位 API 將回傳 400：
   - `date`（YYYY-MM-DD 格式，必填）：當天日期，例如 `"2026-07-01"`
   - `dayOfWeek`（中文星期，必填）：`"一"` / `"二"` / `"三"` / `"四"` / `"五"` / `"六"` / `"日"`
   - `label`（≤ 8 字，必填）：當日主題，例如 `"抵達那霸"` / `"美麗海水族館"`

   > ⚠️ Windows encoding 注意：curl -d 中的中文在 Windows shell 會變亂碼，一律用 node writeFileSync + --data @file

   ```bash
   node -e "require('fs').writeFileSync('/tmp/day.json', JSON.stringify({...完整一天資料...}), 'utf8')"
   curl -s -X PUT \
     -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     -H "Content-Type: application/json" \
     --data @/tmp/day.json \
     "https://trip-planner-dby.pages.dev/api/trips/{tripId}/days/{N}"
   ```
8. 建立 docs（flights、checklist、backup、suggestions、emergency）：

   > ⚠️ Windows encoding 注意：curl -d 中的中文在 Windows shell 會變亂碼，一律用 node writeFileSync + --data @file

   ```bash
   node -e "require('fs').writeFileSync('/tmp/doc.json', JSON.stringify({content:'...'}), 'utf8')"
   curl -s -X PUT \
     -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     -H "Content-Type: application/json" \
     --data @/tmp/doc.json \
     "https://trip-planner-dby.pages.dev/api/trips/{tripId}/docs/{type}"
   ```

### Phase 2：並行充填（Agent teams）

9. 對每一天啟動一個 Agent（sonnet），並行執行：
   - 用 WebSearch 查詢缺少 `googleRating` 的地點/餐廳評分
   - Agent 透過 PATCH API 補充各 entry 的評分資訊：

     > ⚠️ Windows encoding 注意：curl -d 中的中文在 Windows shell 會變亂碼，一律用 node writeFileSync + --data @file

     ```bash
     node -e "require('fs').writeFileSync('/tmp/patch.json', JSON.stringify({googleRating:4.5}), 'utf8')"
     curl -s -X PATCH \
       -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
       -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
       -H "Content-Type: application/json" \
       --data @/tmp/patch.json \
       "https://trip-planner-dby.pages.dev/api/trips/{tripId}/entries/{eid}"
     ```
10. 收集所有 Agent 完成後確認資料完整
11. 確保不引入 null 值（找不到 → `googleRating` 省略）

### Phase 3：驗證

12. 執行 `/tp-check` 完整模式驗證（透過 API 讀取資料驗證）
13. 回報建立完成摘要

## tripId 命名規則

`{destination}-trip-{year}-{owner}`，例如：`okinawa-trip-2026-Ray`

## 注意事項

- 所有資料均透過 API 建立，不建立本地 MD 檔案
- 不執行 git commit / push（資料已直接寫入 D1 database）
- 不執行 npm run build（無 dist 產物需產生）
