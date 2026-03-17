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
  - `CF-Access-Client-Id`: `e5902a9d6f5181b8f70e12f1c11ebca3.access`
  - `CF-Access-Client-Secret`: `9c7d873d558eaf65cdc4160f9ec8f0c06d4f387fc069c7a7e1add0b8196b43a8`

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
4. 依修改類型選擇對應 API 寫回：
   - **修改單一 entry**：PATCH `/api/trips/{tripId}/entries/{eid}`
   - **覆寫整天**（結構性問題）：PUT `/api/trips/{tripId}/days/{N}`
   - **修改餐廳**：PATCH `/api/trips/{tripId}/restaurants/{rid}`
   - **修改購物**：PATCH `/api/trips/{tripId}/shopping/{sid}`
   - **更新 doc**（checklist/backup/suggestions）：PUT `/api/trips/{tripId}/docs/{type}`

   所有寫入操作須帶認證 headers：
   ```bash
   curl -s -X PATCH \
     -H "CF-Access-Client-Id: e5902a9d6f5181b8f70e12f1c11ebca3.access" \
     -H "CF-Access-Client-Secret: 9c7d873d558eaf65cdc4160f9ec8f0c06d4f387fc069c7a7e1add0b8196b43a8" \
     -H "Content-Type: application/json" \
     -d '{...}' \
     "https://trip-planner-dby.pages.dev/api/trips/{tripId}/entries/{eid}"
   ```
5. 同步更新 checklist、backup、suggestions docs（若 timeline 有變動）
6. 驗證所有 travel 的 type + 分鐘數是否合理（不改路線順序，但修正明顯錯誤的交通方式或時間）
7. **tp-check（after-fix）**：執行完整模式 report，確認修正結果
8. 不自動 commit（資料已直接寫入 D1 database）

## 重整範圍

檢查現有行程的每個欄位是否符合 R0-R15，修正不符規則的部分。
**不改 timeline 順序、不新增/移除景點**，只確保現有內容符合品質規則。

## 注意事項

- 所有資料讀寫均透過 API，不操作本地 MD 檔案
- 不執行 git commit / push（資料已直接寫入 D1 database）
- 不執行 npm run build（無 dist 產物需產生）
