## Why

目前旅伴請求系統透過 GitHub Issues REST API 運作，存在嚴重的**寫入後讀取時間差**問題——旅伴送出請求後，因 GitHub API 的 eventual consistency，用 label 過濾查詢經常查不到剛建立的 Issue。此外，GitHub PAT 直接暴露在前端 `edit.js` 中，任何人檢視原始碼即可取得，是安全隱患。

遷移到 Cloudflare D1（SQLite）+ Pages Functions 可以：
1. 寫入後立即可讀（強一致性）
2. 消除前端暴露的認證憑證
3. 透過 Cloudflare Access 實現 email 級別的認證與行程級別的授權

## What Changes

- **新增 `manage/index.html`**：取代原 `edit.html`，旅伴請求頁面，支援行程切換，改打 D1 API
- **新增 `admin/index.html`**：權限管理頁面，僅管理者可進入，設定 email ↔ tripId 對應
- **新增 `functions/api/`**：Pages Functions API endpoints（requests、my-trips、permissions）
- **新增 `wrangler.toml`**：D1 database binding 設定
- **廢棄 `edit.html`**：重新導向到 `/manage/`
- **移除 GitHub PAT**：從 `js/shared.js` 移除 `GH_OWNER`/`GH_REPO`，從 `edit.js` 移除 PAT
- **修改 `js/shared.js`**：移除 GitHub 相關常數
- **新增 `css/manage.css`**：原 `edit.css` 重構
- **新增 `css/admin.css`**：管理頁面樣式
- **新增 `js/manage.js`**：原 `edit.js` 重寫，改用 fetch `/api/*`
- **新增 `js/admin.js`**：權限管理 CRUD 邏輯
- **修改 `/tp-request` skill**：改為呼叫 D1 API（GET/PATCH）取代 `gh issue` CLI

## Capabilities

### New Capabilities
- `d1-api`: D1 database schema、Pages Functions API endpoints（requests CRUD、my-trips、permissions CRUD）、JWT 驗證 middleware
- `access-auth`: Cloudflare Access 認證設定（Email OTP + Google）、Access Application 配置（manage/admin 兩組 policy）、Service Token for CLI
- `permission-sync`: admin 新增/移除權限時自動同步 D1 permissions table 與 Cloudflare Access policy 白名單
- `manage-page`: 旅伴請求頁面（/manage/），含行程切換、請求列表、送出請求，取代原 edit.html
- `admin-page`: 管理者權限管理頁面（/admin/），含行程選擇、email 白名單 CRUD

### Modified Capabilities
- `edit-page`: 原 edit.html 廢棄，重新導向到 `/manage/`

## Impact

**檔案影響：**
- 新增：`manage/index.html`、`admin/index.html`、`css/manage.css`、`css/admin.css`、`js/manage.js`、`js/admin.js`、`functions/api/*.ts`、`wrangler.toml`
- 修改：`js/shared.js`（移除 GH 常數）、`index.html`（edit 連結改指向 /manage/）
- 廢棄：`edit.html`（保留但 redirect）、`css/edit.css`、`js/edit.js`

**外部依賴：**
- Cloudflare D1（免費方案：5M reads/day、100K writes/day、5GB）
- Cloudflare Access（免費方案：50 users）
- Cloudflare API Token（環境變數，用於同步 Access policy）

**Skill 影響：**
- `/tp-request`：從 `gh issue list/comment/close` 改為 HTTP API 呼叫
- `/tp-check`、`/tp-create`、`/tp-edit` 等：不受影響（僅操作 MD/JSON）

**無 checklist/backup/suggestions 連動影響**（本次變更不涉及行程 MD 結構）
