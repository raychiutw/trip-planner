## Context

目前旅伴請求系統透過 GitHub Issues API 運作，前端 `edit.js` 直接呼叫 `api.github.com`，PAT 暴露在原始碼中。GitHub API 為 eventual consistency，導致寫入後 label 查詢無法立即回傳新建的 Issue。

現有架構：瀏覽器 → GitHub Issues API（PAT 明文）→ 手動 `/tp-request` 處理 → `gh issue comment/close`

目標架構：瀏覽器 → Cloudflare Access 閘門 → Pages Functions → D1 (SQLite)

## Goals / Non-Goals

**Goals:**
- 寫入後立即可讀（D1 強一致性）
- 前端零密鑰暴露（認證由 Cloudflare Access 處理）
- Email 級認證 + 行程級授權（誰能操作哪個行程）
- 管理者可透過 admin 頁面管理 email ↔ tripId 對應，自動同步 Access policy
- `/tp-request` 改用 HTTP API，不依賴 `gh` CLI

**Non-Goals:**
- 即時推播 / WebSocket（重整即可看到更新）
- 遷移既有 GitHub Issues 資料
- 修改行程 MD 檔案格式或 build 流程
- index.html / setting.html 的功能變更

## Decisions

### 1. 資料庫選擇：Cloudflare D1

**選定**：D1（SQLite on Cloudflare edge）

**替代方案**：
- Supabase（PostgreSQL）：功能豐富但多一個外部服務，免費額度需另外註冊帳號
- Firebase Firestore：NoSQL，Security Rules 語法 verbose
- Cloudflare KV：eventually consistent，與 GitHub Issues 相同問題

**理由**：D1 與 Cloudflare Pages 原生整合，同專案部署，強一致性，免費額度（5M reads/day）遠超需求。台灣有 Cloudflare PoP，延遲極低。

### 2. API 層：Pages Functions

**選定**：`functions/` 目錄下的 Pages Functions（自動路由）

**結構**：
```
functions/api/
├── requests.ts          → GET/POST /api/requests
├── requests/[id].ts     → PATCH /api/requests/:id
├── my-trips.ts          → GET /api/my-trips
├── permissions.ts       → GET/POST /api/permissions
└── permissions/[id].ts  → DELETE /api/permissions/:id
```

每個 function export `onRequestGet`/`onRequestPost`/`onRequestPatch`/`onRequestDelete`，Cloudflare 自動對應 HTTP method。

### 3. 認證方案：Cloudflare Access（雙認證方式）

**選定**：Email OTP + Google 登入（兩個都開）

**Access Applications**：
- **manage**：保護 `/manage/*` + `/api/requests*` + `/api/my-trips`，允許所有旅伴 email
- **admin**：保護 `/admin/*` + `/api/permissions*`，僅允許管理者 email

**Service Token**：給 `/tp-request` CLI 用，帶 `CF-Access-Client-Id` + `CF-Access-Client-Secret` header

### 4. 授權方案：D1 permissions table + Access 自動同步

**選定**：方案 A — admin 頁面新增/移除權限時，同時更新 D1 和 Cloudflare Access policy

**流程**：
1. admin 新增 email → INSERT D1 permissions → Cloudflare API 更新 Access policy include 列表
2. admin 移除 email → DELETE D1 row → 若該 email 無其他行程權限 → 從 Access policy 移除
3. API 端雙重驗證：Access 閘門（CDN 層）+ Pages Function 檢查 permissions table

**環境變數**（存 Cloudflare Dashboard，不進 git）：
- `CF_API_TOKEN`：Cloudflare API Token（Access policy 讀寫權限）
- `CF_ACCOUNT_ID`：Cloudflare Account ID
- `CF_ACCESS_APP_ID`：manage Access Application UUID
- `CF_ACCESS_POLICY_ID`：manage Allow policy UUID
- `ADMIN_EMAIL`：管理者 email

### 5. 頁面結構：/manage/ + /admin/

**選定**：獨立目錄（非根目錄 HTML）

- `/manage/index.html`：原 `edit.html` 重構，新增行程切換 dropdown（從 `/api/my-trips` 取得）
- `/admin/index.html`：獨立管理頁面，行程選擇 + email CRUD
- `/edit.html`：保留但加 `<meta http-equiv="refresh">` 重新導向到 `/manage/`

### 6. DB Schema

```sql
CREATE TABLE requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id      TEXT NOT NULL,
  mode         TEXT NOT NULL CHECK (mode IN ('trip-edit', 'trip-plan')),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  submitted_by TEXT,
  reply        TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_requests_trip_id ON requests(trip_id);
CREATE INDEX idx_requests_status ON requests(status);

CREATE TABLE permissions (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  email   TEXT NOT NULL,
  trip_id TEXT NOT NULL,
  role    TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  UNIQUE(email, trip_id)
);
CREATE INDEX idx_permissions_email ON permissions(email);
```

## Risks / Trade-offs

- **[Cloudflare Access 免費額度]** 50 users 上限 → 目前旅伴數量遠低於此，短期無風險。若超過需升級付費方案。
- **[Access policy 同步失敗]** admin 新增權限時 Cloudflare API 不可用 → D1 寫入回滾，前端顯示錯誤提示，管理者重試即可。
- **[Service Token 外洩]** tp-request 用的 token 存在本地環境 → 風險可控，僅能操作 requests API。可定期輪換。
- **[edit.html 舊連結]** 旅伴可能已存書籤 → 保留 redirect，不會斷掉。
- **[D1 寫入限制]** 免費 100K writes/day → 旅伴請求量極低，無風險。
- **[Pages Functions 冷啟動]** 首次請求可能有 ~50ms 延遲 → 相比 GitHub API 150-400ms 仍大幅改善。

## Migration Plan

1. **Phase 1 — 基礎建設**：建立 D1 database + schema、wrangler.toml、Pages Functions API endpoints
2. **Phase 2 — 前端頁面**：建立 manage/index.html + admin/index.html，搭配新的 JS/CSS
3. **Phase 3 — Access 設定**：Dashboard 設定 Access Applications + policies，測試認證流程
4. **Phase 4 — tp-request 改造**：skill 改為呼叫 HTTP API
5. **Phase 5 — 清理**：edit.html 加 redirect、移除 GitHub PAT/常數、更新 CLAUDE.md

**Rollback**：Phase 1-2 期間原 edit.html 仍正常運作，可隨時回退。Phase 5 前都是增量部署。

## Open Questions

- Cloudflare Access 的 Session duration 設多長？建議旅行期間 7 天，但可能需要根據使用情境調整。
- 是否需要在 manage 頁面顯示「誰送的」（submitted_by）？目前 edit.html 不顯示，但 D1 有這個欄位可用。
- wrangler.toml 是否需要設定 `[env.production]` 和 `[env.preview]` 分環境？
