---
name: tp-edit
description: Use when modifying an existing trip itinerary partially via natural language — swap a restaurant, add a stop, update a single POI field. For bulk POI field updates across trips use /tp-patch; for full R0-R18 audit use /tp-rebuild.
user-invocable: true
---

接受自然語言描述，局部修改指定行程資料（D1 API）。修改後執行 tp-check 精簡 report。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## API 設定

API 設定、呼叫格式、Windows encoding 注意事項見 tp-shared/references.md

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
3. 新增或替換 POI 的必填欄位（source、note、googleQuery、googleRating）+ 韓國 naverQuery — **詳見 tp-shared/references.md「行程修改共用步驟」**
4. 修改的部分須符合 R0-R18 品質規則
5. 依修改類型選擇 API（PATCH entry / PUT 整天 / POST trip-pois / PUT doc）— **端點見 tp-shared/references.md「行程修改共用步驟」**
6. **location 座標更新**：新增或替換景點時，必須用 `PATCH /entries/:eid` 補寫 `location` JSON（含 lat/lng），否則天氣功能無法顯示。格式：`[{"name":"地點名","lat":24.xx,"lng":121.xx,"googleQuery":"...","appleQuery":"...","geocode_status":"ok"}]`。座標可用 WebSearch 查詢「{地點名} 座標 經緯度」取得。
7. **Doc 連動（鐵律）**+ **travel 重算** — 規則見 tp-shared/references.md
7. 執行 tp-check 精簡模式，輸出：`tp-check: 🟢 N  🟡 N  🔴 N`
8. 不自動 commit（資料已直接寫入 D1 database，無需 git 操作）

## 局部修改 vs 全面重整

本 skill 只處理描述涉及的修改範圍，例如：
- 「Day 3 午餐換成拉麵」→ 只改 Day 3 午餐 entry
- 「加一個景點到 Day 2」→ 只在 Day 2 timeline 插入
- 「刪除 Day 4 的購物行程」→ 只移除該 entry

**不全面重跑 R0-R18**。如需全面重整，使用 `/tp-rebuild`。

## 注意事項

- 所有資料讀寫均透過 API，不操作本地 MD 檔案
- 不執行 git commit / push（資料已直接寫入 D1 database）
- 不執行 npm run build（無 dist 產物需產生）

## Markdown 支援欄位

Markdown 支援欄位見 tp-shared/references.md
