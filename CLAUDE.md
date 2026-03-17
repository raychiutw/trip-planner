# 行程規劃網站（trip-planner）

## 專案結構

```
index.html          setting.html        edit.html（redirect → /manage/）
manage/             index.html（旅伴請求頁）
admin/              index.html（權限管理頁）
css/                shared.css  style.css  setting.css  manage.css  admin.css
js/                 shared.js   icons.js   app.js   setting.js   manage.js   admin.js
functions/api/      _middleware.ts  _audit.ts  trips.ts  requests.ts  permissions.ts  my-trips.ts
                    trips/[id].ts  trips/[id]/days.ts  days/[num].ts  docs/[type].ts
                    entries/[eid].ts  restaurants/[rid].ts  shopping/[sid].ts  ...
migrations/         0001_init.sql  0002_trips.sql
scripts/            migrate-md-to-d1.js  tp-check.js  memory-sync.sh  register-scheduler.ps1
tests/              unit/  integration/  e2e/
.claude/skills/     tp-check  tp-create  tp-edit  tp-request  tp-patch  tp-rebuild  tp-deploy  tp-code-verify  ...
openspec/           config.yaml  specs/  changes/
wrangler.toml       D1 database binding
```

- Cloudflare Pages：https://trip-planner-dby.pages.dev/
- 資料庫：Cloudflare D1（trip-planner-db）

## 資料架構

行程資料全部儲存在 D1 結構化 table，前端透過 Pages Functions API 即時讀取：

```
D1 Tables:
  trips           行程主表（id, name, owner, title, selfDrive, countries, ...）
  days            天（trip_id FK, day_num, date, label, weather_json）
  hotels          飯店（day_id FK, name, checkout, parking_json）
  entries         時間軸項目（day_id FK, sort_order, time, title, maps, rating, travel_*）
  restaurants     餐廳推薦（entry_id FK, name, category, hours, price, rating）
  shopping        購物推薦（parent_type, parent_id, name, category, mustBuy）
  trip_docs       附屬文件（trip_id, doc_type, content）— flights/checklist/backup/suggestions/emergency
  audit_log       修改審計（trip_id, table_name, action, diff_json, snapshot）
  requests        旅伴請求（trip_id, mode, title, body, reply, status）
  permissions     權限（email, trip_id, role）
```

## API 端點

```
公開讀取（不需認證）：
  GET /api/trips                         行程列表
  GET /api/trips/:id                     行程 meta
  GET /api/trips/:id/days                所有天概要
  GET /api/trips/:id/days/:num           完整一天（hotel + entries + restaurants + shopping）
  GET /api/trips/:id/docs/:type          附屬文件

需認證寫入（Zero Trust 成員或 Service Token）：
  PUT    /api/trips/:id                  更新 meta
  PUT    /api/trips/:id/days/:num        覆寫整天
  PATCH  /api/trips/:id/entries/:eid     修改 entry
  DELETE /api/trips/:id/entries/:eid     刪除 entry
  POST   /api/trips/:id/entries/:eid/restaurants  新增餐廳
  PATCH  /api/trips/:id/restaurants/:rid          修改餐廳
  POST/PATCH/DELETE shopping 同理
  PUT    /api/trips/:id/docs/:type       更新文件

旅伴請求（Access 認證）：
  GET  /api/requests?tripId=xxx          列出請求
  POST /api/requests                     送出請求
  PATCH /api/requests/:id                回覆 + 關閉

管理（僅 admin）：
  GET/POST/DELETE /api/permissions       權限 CRUD
  GET /api/trips/:id/audit               修改歷史
  POST /api/trips/:id/audit/:aid/rollback 回滾
```

## 開發規則

- **Git**：commit 後不自動 push，由使用者手動觸發；commit 訊息繁體中文
- **測試**：commit 前必須測試全過（pre-commit hook 自動執行）；文件變更不跑測試
- **命名規範驗證**：commit 前必須跑 `/tp-code-verify` 驗證命名規範綠燈，紅燈則持續修改直到通過；命名規範詳見 `.claude/skills/references/naming-rules.md`（`openspec/config.yaml` naming 區塊為摘要）
- **資料層**：D1 為唯一資料來源，透過 API 讀寫；不需 build 步驟
- **行程品質**：產生或修改行程須遵守品質規則，完成後執行 `/tp-check`
- **Skills**：所有 tp-* skills 透過 API 操作行程資料，不操作本地檔案，不需 git commit/push 資料變更
- **內容**：繁體中文台灣用語、travel 含 type + 分鐘數、days 變動同步 checklist/backup/suggestions
- **UI**：無框線設計、卡片統一、全站 inline SVG（Material Symbols Rounded）
- **CSS HIG 紀律**：12 條規則由 `tests/unit/css-hig.test.js` 自動守護，完整規範見 `.claude/commands/tp-hig.md`
- **Agent / Sub Agent**：
  - **Model**：所有 sub agent 一律使用 `model: "sonnet"`；僅在需要高度判斷力時才指定 `model: "opus"`
  - **並行**：獨立任務盡量同時發送多個 Agent tool call
  - **背景執行**：不需要立即結果的長時間任務用 `run_in_background: true`
  - **Worktree 隔離**：多 agent 並行修改檔案時用 `isolation: "worktree"` 避免衝突
- **OpenSpec**：功能開發遵守 openspec 流程，除非使用者同意跳過

## 認證架構

- **Cloudflare Access**：/manage/ + /admin/ + 寫入 API 受保護
- **Zero Trust 成員**：通過 Access 登入即可寫入行程
- **Admin**（lean.lean@gmail.com）：可管理權限、查看 audit log、rollback
- **Service Token**：tp-request CLI 用，等同 admin 權限

## 已知問題與解法

### Chrome 手機版捲動彈回（設定頁）

**問題**：`setting.html` 在 Chrome 手機版捲到底部會彈回頂部。

**根因**：`shared.css` 的捲動基礎設施為行程頁設計，與設定頁簡單結構在 Chrome 合成層計算中衝突。

**解法**（`css/setting.css`）：

```css
html.page-setting { scroll-behavior: auto; scrollbar-gutter: auto; overflow: visible; overscroll-behavior: none; }
.page-setting { max-width: none; overflow: visible; }
.page-setting .page-layout { display: block; min-height: 0; }
.page-setting .container { transition: none; }
.page-setting .sticky-nav { position: relative; }
```

**教訓**：新增頁面時，若結構與行程頁差異大，須一次性重置所有捲動相關屬性。
