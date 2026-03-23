## 1. DB Schema

- [x] 1.1 建立 `migrations/0002_trips.sql`：trips + days + hotels + entries + restaurants + shopping + trip_docs + audit_log 全部 table + indexes + CASCADE
- [x] 1.2 執行 migration：`wrangler d1 migrations apply trip-planner-db --remote`

## 2. 行程 API — 讀取（公開）

- [x] 2.1 建立 `functions/api/trips.ts`：GET 列表（published 篩選 + admin 全部）
- [x] 2.2 建立 `functions/api/trips/[id].ts`：GET meta + PUT 更新 meta
- [x] 2.3 建立 `functions/api/trips/[id]/days.ts`：GET 所有天概要
- [x] 2.4 建立 `functions/api/trips/[id]/days/[num].ts`：GET 完整一天（JOIN hotel + entries + restaurants + shopping）+ PUT 覆寫整天
- [x] 2.5 建立 `functions/api/trips/[id]/docs/[type].ts`：GET/PUT trip_docs
- [x] 2.6 確保 GET endpoints 公開存取（middleware 跳過認證）

## 3. 行程 API — 寫入（需認證）

- [x] 3.1 建立 `functions/api/trips/[id]/entries/[eid].ts`：PATCH/DELETE 單一 entry
- [x] 3.2 建立 `functions/api/trips/[id]/entries/[eid]/restaurants.ts`：POST 新增餐廳
- [x] 3.3 建立 `functions/api/trips/[id]/restaurants/[rid].ts`：PATCH/DELETE 餐廳
- [x] 3.4 建立 `functions/api/trips/[id]/entries/[eid]/shopping.ts`：POST 新增購物（entry 下）
- [x] 3.5 建立 `functions/api/trips/[id]/hotels/[hid]/shopping.ts`：POST 新增購物（hotel 下）
- [x] 3.6 建立 `functions/api/trips/[id]/shopping/[sid].ts`：PATCH/DELETE 購物
- [x] 3.7 修改 `_middleware.ts`：GET /api/trips/** 公開存取，寫入需認證

## 4. Audit Log

- [x] 4.1 建立 audit log 工具函式：logAudit(env, { tripId, tableName, recordId, action, changedBy, requestId, diffJson, snapshot })
- [x] 4.2 在所有寫入 handler 中呼叫 logAudit
- [x] 4.3 建立 `functions/api/trips/[id]/audit.ts`：GET 查詢歷史
- [x] 4.4 建立 `functions/api/trips/[id]/audit/[aid]/rollback.ts`：POST 回滾

## 5. 遷移腳本

- [x] 5.1 建立 `scripts/migrate-md-to-d1.js`：讀取 MD → parse → 呼叫 API INSERT（或用 wrangler d1 execute）
- [x] 5.2 遷移全部 7 個行程（7 trips, 49 days, 294 entries, 263 restaurants, 165 shopping, 42 hotels）
- [x] 5.3 驗證：D1 資料筆數確認正確

## 6. 前端切換

- [x] 6.1 修改 `js/app.js`：loadTrip() 改 fetch('/api/trips/:id')，loadDay() 改 fetch('/api/trips/:id/days/:num')
- [x] 6.2 修改 `js/app.js`：info panel 的 flights/checklist/backup/suggestions/emergency 改 fetch('/api/trips/:id/docs/:type')
- [x] 6.3 修改 `js/setting.js`：行程清單改 fetch('/api/trips')
- [x] 6.4 修改 `js/admin.js`：行程 dropdown 改 fetch('/api/trips?all=1')
- [x] 6.5 確認 API JSON 結構與 render 函式相容，必要時調整 API response 格式
- [x] 6.6 更新 `index.html` CSP（若需要）

## 7. Skills 更新

- [x] 7.1 修改 tp-request skill：改用 API 讀寫行程，不再操作 MD/git/build
- [x] 7.2 修改 tp-edit skill：改用 API
- [x] 7.3 修改 tp-create skill：改用 POST /api/trips + PUT days 建立新行程
- [x] 7.4 修改 tp-check skill：改為驗 API/DB 資料
- [x] 7.5 修改 tp-rebuild skill：改用 API 批次更新
- [x] 7.6 修改 tp-patch skill：改用 API
- [x] 7.7 修改 tp-deploy skill：移除 build 步驟（純 git push 前端程式碼）
- [x] 7.8 同步更新 .gemini/skills/ 對應檔案

## 8. 清理

- [x] 8.1 git tag v1-md-era 保留目前版本備份
- [x] 8.2 刪除 `data/trips-md/`、`data/dist/`、`data/examples/`
- [x] 8.3 刪除 `scripts/build.js`、`scripts/trip-build.js`
- [x] 8.4 修改 `package.json`：移除 build script
- [x] 8.5 修改 pre-commit hook：更新觸發 pattern
- [x] 8.6 刪除 `tests/json/`（schema/quality/registry）+ 修正 render-pipeline + load-fallback
- [x] 8.7 更新 `CLAUDE.md`：架構說明改為 D1 API 驅動
- [x] 8.8 更新 `openspec/config.yaml`
- [x] 8.9 執行全套測試確認無 regression（252 tests passed）
