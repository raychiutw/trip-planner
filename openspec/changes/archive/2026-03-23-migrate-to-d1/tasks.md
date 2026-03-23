## 1. D1 基礎建設

- [x] 1.1 建立 `wrangler.toml`，設定 D1 database binding（DB）和 Pages 相容設定
- [ ] 1.2 用 `wrangler d1 create trip-planner-db` 建立 D1 database（手動）
- [x] 1.3 建立 `migrations/0001_init.sql`，包含 requests + permissions table schema 和 indexes
- [ ] 1.4 執行 migration：`wrangler d1 migrations apply trip-planner-db`（手動）
- [ ] 1.5 在 Cloudflare Dashboard 設定環境變數：CF_API_TOKEN、CF_ACCOUNT_ID、CF_ACCESS_APP_ID、CF_ACCESS_POLICY_ID、ADMIN_EMAIL（手動）

## 2. Pages Functions API

- [x] 2.1 建立 `functions/api/_middleware.ts`：JWT 驗證 + Service Token 辨識，提取 email 到 context
- [x] 2.2 建立 `functions/api/requests.ts`：GET（列表查詢 + 權限檢查）和 POST（新增 + 權限檢查 + submitted_by 自動填入）
- [x] 2.3 建立 `functions/api/requests/[id].ts`：PATCH（更新 reply + status）
- [x] 2.4 建立 `functions/api/my-trips.ts`：GET（從 JWT email 查 permissions，回傳有權 tripId 列表）
- [x] 2.5 建立 `functions/api/permissions.ts`：GET（列出行程權限）和 POST（新增 + Access 同步）
- [x] 2.6 建立 `functions/api/permissions/[id].ts`：DELETE（移除 + 條件式 Access 同步）
- [x] 2.7 建立 Access policy 同步工具函式（讀取/更新 Cloudflare Access policy include 列表）（整合在 permissions.ts 中）
- [ ] 2.8 為 API endpoints 撰寫 integration tests（用 miniflare 或 wrangler dev 模擬）

## 3. Cloudflare Access 設定

- [ ] 3.1 在 Cloudflare Zero Trust Dashboard 建立 Access Application「manage」：保護 /manage/* + /api/requests* + /api/my-trips，認證 Email OTP + Google，Session 7 days
- [ ] 3.2 建立 Access Application「admin」：保護 /admin/* + /api/permissions*，僅允許管理者 email
- [ ] 3.3 建立 Service Token「tp-request」，記錄 Client ID + Secret
- [ ] 3.4 測試認證流程：未登入 → 登入頁 → OTP/Google → 取得 cookie → 存取 API

## 4. manage 頁面（取代 edit.html）

- [x] 4.1 建立 `manage/index.html`，頁面結構參考現有 edit.html，加入行程切換 dropdown
- [x] 4.2 建立 `css/manage.css`，遵循 HIG 規範（--fs-* tokens、無框線、卡片統一）
- [x] 4.3 建立 `js/manage.js`：載入時呼叫 /api/my-trips → 填充 dropdown → 自動載入第一個行程的 requests
- [x] 4.4 實作行程切換邏輯：切換 dropdown 時重新 GET /api/requests?tripId=xxx
- [x] 4.5 實作請求列表渲染：卡片式顯示 title、body、reply、status、created_at
- [x] 4.6 實作送出請求：POST /api/requests，成功後 optimistic insert 到列表頂部
- [x] 4.7 實作 mode 切換：trip-edit / trip-plan 兩種模式選擇 UI
- [x] 4.8 實作空狀態和無權限狀態的 UI
- [ ] 4.9 撰寫 manage 頁面 unit tests（render 函式測試）
- [ ] 4.10 撰寫 manage 頁面 E2E tests（Playwright：載入、切換行程、送出請求）

## 5. admin 頁面

- [x] 5.1 建立 `admin/index.html`，頁面結構含行程 dropdown + 權限表格 + 新增表單
- [x] 5.2 建立 `css/admin.css`，遵循 HIG 規範
- [x] 5.3 建立 `js/admin.js`：從 trips.json 讀取行程列表填充 dropdown
- [x] 5.4 實作權限列表載入：選擇行程後 GET /api/permissions?tripId=xxx
- [x] 5.5 實作新增權限：輸入 email → POST /api/permissions → 刷新列表
- [x] 5.6 實作移除權限：點擊移除 → confirm → DELETE /api/permissions/:id → 刷新列表
- [x] 5.7 實作錯誤處理：409 重複、500 同步失敗、403 非 admin 等狀態顯示
- [ ] 5.8 撰寫 admin 頁面 unit tests
- [ ] 5.9 撰寫 admin 頁面 E2E tests

## 6. tp-request skill 改造

- [x] 6.1 修改 `.claude/skills/tp-request/SKILL.md`：將 `gh issue list` 改為 `curl GET /api/requests?status=open`（帶 Service Token headers）
- [x] 6.2 修改回覆流程：將 `gh issue comment` + `gh issue close` 改為 `curl PATCH /api/requests/:id`
- [x] 6.3 同步修改 `.gemini/skills/tp-request/SKILL.md`
- [ ] 6.4 測試完整 tp-request 流程：讀取 open requests → 處理 → 回覆關閉（需 D1 + Access 設定完成後）

## 7. 清理與遷移

- [x] 7.1 修改 `edit.html`：清空內容，加入 meta refresh 重新導向到 /manage/
- [x] 7.2 修改 `js/shared.js`：移除 GH_OWNER、GH_REPO 常數
- [x] 7.3 修改 `index.html`：將 edit.html 連結改指向 /manage/，移除 CSP 中 api.github.com
- [ ] 7.4 在 D1 permissions table 匯入初始權限資料（7 個行程的 owner + 旅伴 email）
- [ ] 7.5 更新 `CLAUDE.md`：加入 D1/Functions/Access 相關專案結構說明
- [ ] 7.6 更新 `openspec/config.yaml`：加入新的檔案結構
- [x] 7.7 執行全套測試確認無 regression（589 tests passed）
