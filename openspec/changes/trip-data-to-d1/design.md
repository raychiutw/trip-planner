## Context

trip-planner 目前的資料流為：MD 檔案 → build.js（MD→JSON parser）→ data/dist/ 靜態 JSON → 前端 fetch。AI（tp-request/tp-edit）直接讀寫 MD 檔案，改完需 build + commit + push + 等 Cloudflare Pages 部署才反映到線上。

migrate-to-d1 已將旅伴請求系統遷入 D1 + Pages Functions。本次將行程資料也遷入同一 D1，徹底移除 MD 資料層和 build 流程。

## Goals / Non-Goals

**Goals:**
- 行程資料全面結構化存入 D1（8 張 table）
- 前端改從 Pages Functions API 即時讀取（消除 build/deploy 延遲）
- AI 透過 JSON API 精確操作行程資料（減少格式錯誤和 token 消耗）
- 每次修改自動記錄 audit log（取代 git diff 歷史追蹤）
- 一次性遷移腳本將 7 個現有行程從 MD 匯入 D1

**Non-Goals:**
- 不改前端 render 邏輯（app.js 的 render 函式不變，只改 fetch 來源）
- 不改 UI/CSS
- 不做即時推播（旅伴重整頁面即可看到更新）
- 不做 DB 版本控制（audit log 即可，不做完整 versioning）

## Decisions

### 1. DB Schema 設計：全結構化 table

**選定：** 每個 MD 中的概念對應一張 table — trips、days、hotels、entries、restaurants、shopping、trip_docs、audit_log

**替代方案：**
- MD 文字存 DB（方案 2）：AI 還是要 parse MD，多一次無意義轉換
- 混合結構（部分 JSON blob）：查詢不便，schema 不一致

**理由：** AI 天生操作結構化資料，JSON 比 MD 更精確、省 token、不會格式出錯。D1 的 SQLite 足夠處理這個規模。

### 2. API 路由設計

```
GET    /api/trips                        → 行程列表（含 published 篩選）
GET    /api/trips/:id                    → 行程 meta
PUT    /api/trips/:id                    → 更新 meta
POST   /api/trips                        → 新增行程

GET    /api/trips/:id/days               → 所有天概要
GET    /api/trips/:id/days/:num          → 完整一天（含 hotel + entries + restaurants + shopping）
PUT    /api/trips/:id/days/:num          → 覆寫整天

PATCH  /api/trips/:id/entries/:eid       → 修改單一 entry
DELETE /api/trips/:id/entries/:eid       → 刪除 entry

POST   /api/trips/:id/entries/:eid/restaurants  → 新增餐廳
PATCH  /api/trips/:id/restaurants/:rid          → 修改餐廳
DELETE /api/trips/:id/restaurants/:rid          → 刪除餐廳

POST   /api/trips/:id/entries/:eid/shopping     → 新增購物（entry 下）
POST   /api/trips/:id/hotels/:hid/shopping      → 新增購物（hotel 下）
PATCH  /api/trips/:id/shopping/:sid             → 修改購物
DELETE /api/trips/:id/shopping/:sid             → 刪除購物

GET    /api/trips/:id/docs/:type         → 讀取文件（flights/checklist/...）
PUT    /api/trips/:id/docs/:type         → 更新文件

GET    /api/trips/:id/audit              → 修改歷史
POST   /api/trips/:id/audit/:aid/rollback → 回滾

POST   /api/trips/import                 → 批次匯入（遷移用）
```

### 3. 前端 fetch 策略

**選定：** app.js 的 `loadTrip()` 和 `loadDay()` 改為 fetch API，回傳的 JSON 結構盡量與現有 dist JSON 一致，最小化 render 函式改動。

**API response 格式**（GET /api/trips/:id/days/:num）與現有 dist/day-N.json 對齊：
```json
{
  "id": 3,
  "date": "2026-07-31",
  "dayOfWeek": "五",
  "label": "美麗海・本部",
  "hotel": { ... },
  "timeline": [ { "time": "09:00", "title": "...", "restaurants": [...], ... } ]
}
```

### 4. Audit Log 設計

每次 INSERT/UPDATE/DELETE 操作自動寫入 audit_log。在 Pages Function handler 中統一處理，不靠 DB trigger（D1 不支援 trigger）。

記錄：table_name、record_id、action、changed_by（from JWT）、request_id（若來自 tp-request）、diff_json（前後差異）、snapshot（刪除前完整 row）。

### 5. 認證與權限

三層存取控制：

- **公開讀取（GET /api/trips/**）：** 不需認證，任何人可讀（跟現在靜態 JSON 一樣）
- **寫入操作（PUT/PATCH/DELETE /api/trips/**）：** 需 Cloudflare Zero Trust 團隊成員身份（已登入 Access）。middleware 檢查 `CF_Authorization` JWT 有效即可，不限特定 email — 只要通過 Zero Trust 登入頁就代表是團隊成員。
- **管理操作（/api/permissions/**、/api/audit/**/rollback）：** 僅 admin（JWT email === ADMIN_EMAIL）
- **Service Token：** tp-request CLI 用，視為 admin 權限

```
未認證          → GET 公開 API ✅ / 寫入 API ❌ 401
Zero Trust 成員 → GET ✅ / 寫入 ✅ / 管理 ❌ 403
Admin           → GET ✅ / 寫入 ✅ / 管理 ✅
Service Token   → 同 Admin
```

**middleware 邏輯：**
1. 檢查 HTTP method — GET 且路徑為 `/api/trips/**` → 跳過認證，直接放行
2. 檢查 Service Token header → 有 → admin 身份
3. 檢查 CF_Authorization JWT → 有效 → 一般團隊成員（可寫入）
4. 無認證 → 401

**Cloudflare Access 設定調整：**
- manage app 的 Allow policy 改為包含所有 Zero Trust 團隊成員（不再逐一加 email）
- 或將寫入 API 路徑也加入 Access Application 保護，讓 Access 閘門在 CDN 層就擋未登入的寫入請求

### 6. 遷移策略

```
Phase 0: 遷移腳本
  node scripts/migrate-md-to-d1.js
  → 讀 data/trips-md/ 所有 MD
  → 用 trip-build.js 的 parse 邏輯
  → INSERT 到 D1 各 table
  → 驗證：API 回傳 JSON ≈ 現有 dist JSON

Phase 1: API endpoints
  建所有 functions/api/trips/** endpoints
  前端暫時不改（還是讀 dist JSON）

Phase 2: 前端切換
  app.js / setting.js 改 fetch API
  驗證所有頁面正常

Phase 3: 清理
  刪 data/trips-md/、data/dist/、scripts/build*、data/examples/
  更新 CLAUDE.md、skills、tests、hooks
```

## Risks / Trade-offs

- **[D1 免費額度]** 前端每次 page view 都打 API（原本是靜態 CDN）→ 讀取量增加。免費 5M reads/day，以目前流量遠低於限制。
- **[冷啟動延遲]** Pages Functions 首次請求 ~50ms → 比靜態 CDN 稍慢，但使用者感知不大。
- **[遷移資料正確性]** MD parse → DB 可能有微差異 → 遷移後需比對驗證。
- **[失去離線存取]** 靜態 JSON 可被瀏覽器快取離線使用，API 不行 → 可用 Cache-Control header 緩解。
- **[Rollback 複雜度]** 如果遷移出問題，需要恢復 MD 資料層 → 在完全刪除 MD 前，先保留一份 git tag 當備份。
