---
name: tp-rebuild
description: Use when the user wants to fully audit and fix all quality rule violations in a single trip itinerary without changing the timeline order or adding/removing stops.
user-invocable: true
---

全面重整單一行程資料，依 R0-R15 品質規則逐項檢查並透過 API 修正。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## API 設定

- **Base URL**: `https://trip-planner-dby.pages.dev`
- **認證**: Service Token headers（寫入操作必填）
  - `CF-Access-Client-Id`: `$CF_ACCESS_CLIENT_ID`
  - `CF-Access-Client-Secret`: `$CF_ACCESS_CLIENT_SECRET`

## 輸入方式

- 指定 tripId：`/tp-rebuild okinawa-trip-2026-Ray`
- 未指定：呼叫 `GET /api/trips` 列出所有行程供選擇

## 步驟

1. 讀取行程所有資料：
   ```bash
   # 讀取 meta
   curl -s "https://trip-planner-dby.pages.dev/api/trips/{tripId}"
   # 讀取所有天概要
   curl -s "https://trip-planner-dby.pages.dev/api/trips/{tripId}/days"
   # 依序讀取每天完整資料
   curl -s "https://trip-planner-dby.pages.dev/api/trips/{tripId}/days/{N}"
   ```
2. **tp-check（before-fix）**：執行完整模式 report，顯示修正前的品質狀態
3. 逐項檢查 R0-R15 品質規則，修正不合格的資料

   **days meta 缺漏修復**（必先於其他修復執行）：
   - 檢查每天的 `date`、`day_of_week`、`label` 是否為 null 或空字串
   - 若 `date` 缺漏：根據 trip `startDate` + `day_num` 推算（startDate + day_num - 1 天）
   - 若 `day_of_week` 缺漏：從推算出的 date 計算中文星期（一/二/三/四/五/六/日）
   - 若 `label` 缺漏：根據當天 timeline 內容摘要，≤ 8 字
   - 修復後透過 PUT `/api/trips/{tripId}/days/{N}` 整天覆寫寫回（含 date、dayOfWeek、label 三個必填欄位）
4. 依修改類型選擇對應 API 寫回：
   - **修改單一 entry**：PATCH `/api/trips/{tripId}/entries/{eid}`
   - **覆寫整天**（結構性問題）：PUT `/api/trips/{tripId}/days/{N}`
   - **修改餐廳**：PATCH `/api/trips/{tripId}/restaurants/{rid}`
   - **修改購物**：PATCH `/api/trips/{tripId}/shopping/{sid}`
   - **更新 doc**（checklist/backup/suggestions）：PUT `/api/trips/{tripId}/docs/{type}`

   所有寫入操作須帶認證 headers：

   > ⚠️ Windows encoding 注意：curl -d 中的中文在 Windows shell 會變亂碼，一律用 node writeFileSync + --data @file

   ```bash
   node -e "require('fs').writeFileSync('/tmp/patch.json', JSON.stringify({...修改欄位...}), 'utf8')"
   curl -s -X PATCH \
     -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     -H "Content-Type: application/json" \
     --data @/tmp/patch.json \
     "https://trip-planner-dby.pages.dev/api/trips/{tripId}/entries/{eid}"
   ```
5. 同步更新 checklist、backup、suggestions docs（若 timeline 有變動）
6. 驗證並修正 location 與 travel 資料：
   - **location 完整性**：每個實體景點的 `location` 必須包含 `name`、`googleQuery`、`appleQuery`、`lat`（小數4位）、`lng`（小數4位）、`geocode_status`（AI 填 `"review"`）
   - **JP 自駕 mapcode**（`meta.countries` 含 `"JP"` 且 `selfDrive`）：entry 層級補上 `mapcode`（格式 `"XXX XXX XXX*XX"`，WebSearch 查詢），查不到時省略
   - **KR naverQuery**（`meta.countries` 含 `"KR"`）：`location.naverQuery` 必填（Naver Maps URL，R14）
   - **travel 合理性**：用 WebSearch 驗證明顯可疑的交通時間（如跨區域標記 10 分鐘），粗估公式：市區 3~4 分/km、郊區 1.5~2 分/km、步行 12~15 分/km
   - `travel_desc` 的分鐘數必須與時間軸間隔一致
   - 覆寫整天（PUT）時，**先 GET 現有資料**，未修改的 entry 保留原始 `location`、`mapcode`、`source`
7. **tp-check（after-fix）**：執行完整模式 report，確認修正結果
8. 不自動 commit（資料已直接寫入 D1 database）

## 重整範圍

檢查現有行程的每個欄位是否符合 R0-R15，修正不符規則的部分。
**不改 timeline 順序、不新增/移除景點**，只確保現有內容符合品質規則。

## 注意事項

- 所有資料讀寫均透過 API，不操作本地 MD 檔案
- 不執行 git commit / push（資料已直接寫入 D1 database）
- 不執行 npm run build（無 dist 產物需產生）
