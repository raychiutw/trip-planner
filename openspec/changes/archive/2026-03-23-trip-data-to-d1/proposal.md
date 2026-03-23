## Why

行程資料目前以 MD 檔案為唯一資料來源，經 `npm run build` 轉為 JSON 後部署到 Cloudflare Pages。每次 AI（tp-request）處理旅伴的修改請求，需經歷「改 MD → build → test → commit → push → 等 Pages 部署」的完整流程，延遲 1-2 分鐘，且 AI 讀寫 MD 時需額外處理 markdown table 對齊等格式問題，容易出錯。

既有 D1 database 已用於旅伴請求系統，將行程資料一併遷入 D1 結構化 table，前端改從 API 即時讀取，可消除 build/deploy 延遲，AI 直接操作結構化 JSON 更精確省 token，且獲得 audit log 追蹤修改歷史的能力。

## What Changes

- **BREAKING** 移除 `data/trips-md/` — MD 檔案不再是資料來源
- **BREAKING** 移除 `data/dist/` — 不再有靜態 JSON build 產物
- **BREAKING** 移除 `scripts/build.js`、`scripts/trip-build.js` — build 流程廢棄
- **BREAKING** 移除 `data/examples/` — MD 格式範本廢棄
- 新增 D1 tables：`trips`、`days`、`hotels`、`entries`、`restaurants`、`shopping`、`trip_docs`、`audit_log`
- 新增 Pages Functions API：行程 CRUD（trips、days、entries、restaurants、shopping、docs）
- 新增 audit log — 每次修改自動記錄 diff + snapshot，支援回滾
- 修改 `js/app.js` — fetch 從 `data/dist/*.json` 改為 `/api/trips/*`
- 修改 `js/setting.js` — 行程清單從 `trips.json` 改為 `/api/trips`
- 修改所有 `tp-*` skills — 不再讀寫 MD 檔案，改用 JSON API
- 修改 `tests/json/` — schema/quality 測試改為驗 API/DB 資料
- 修改 `pre-commit hook` — 移除 build 步驟
- 修改 `package.json` — 移除 `build` script
- 新增一次性遷移腳本 — 從 MD parse 後 INSERT 到 D1

## Capabilities

### New Capabilities
- `trip-api`: 行程 CRUD API endpoints — trips 列表/詳情、days 讀寫、entries/restaurants/shopping 的 CRUD、docs 讀寫
- `trip-schema`: D1 結構化 schema — trips/days/hotels/entries/restaurants/shopping/trip_docs 七張 table 及索引
- `audit-log`: 修改審計記錄 — 自動記錄每次 insert/update/delete 的 diff_json + snapshot，支援按行程/時間/請求查詢及回滾
- `trip-migration`: 一次性遷移工具 — 從現有 MD 檔案 parse 並 INSERT 到 D1，遷移完成後移除 MD 相關檔案
- `frontend-api-fetch`: 前端改為 API 驅動 — app.js/setting.js 從靜態 JSON 改為 fetch API

### Modified Capabilities
（無既有 spec 需修改 — 本次是全面取代資料層）

## Impact

**刪除的檔案：**
- `data/trips-md/` 所有子目錄和 MD 檔案（7 個行程 × ~11 檔）
- `data/dist/` 所有 JSON 檔案
- `data/examples/*.md`
- `scripts/build.js`、`scripts/trip-build.js`
- `tests/json/schema.test.js`、`tests/json/quality.test.js`（改寫為 API 測試）

**修改的檔案：**
- `js/app.js` — fetch 來源改為 API
- `js/setting.js` — 行程清單改為 API
- `index.html` — CSP 可能需更新
- `package.json` — 移除 build script、可能調整 test script
- `.claude/skills/tp-*.md` — 全部改為 API 操作
- `.gemini/skills/tp-*.md` — 同步更新
- `CLAUDE.md` — 架構說明全面更新
- `pre-commit hook` — 移除 build 相關步驟

**新增的檔案：**
- `functions/api/trips/**` — 行程 API endpoints
- `migrations/0002_trips.sql` — 行程 table schema
- `scripts/migrate-md-to-d1.js` — 一次性遷移腳本

**外部依賴影響：**
- D1 寫入量增加（行程修改直接寫 DB）
- Cloudflare Pages 變為純靜態前端 + Functions API（不再需要 build step）

**checklist/backup/suggestions 連動：** 這些檔案改存為 `trip_docs` table 的 rows（doc_type 欄位區分），內容直接存純文字，不受結構化 schema 影響
