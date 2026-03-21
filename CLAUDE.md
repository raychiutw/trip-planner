# 行程規劃網站（trip-planner）

## 團隊協作

本專案有 6 個角色：**Key User** (使用者) → **PM** (Claude) → **工程師** / **Code Reviewer** / **QC** / **Challenger** (Teammate)

- **涉及 code 變更的任務都用 Team 處理**，確保每個改動都經過完整審查流程。行程資料操作（tp-* skill）PM 直接操作，不建 Team。
- PM 禁止改 code、跑測試、debug。要改 code 必須派工程師 Teammate。
- 派 Teammate 或團隊協作時，PM 必須先 **invoke `/tp-team`** 載入完整團隊規則。
- `/tp-team` 包含：權責矩陣、Challenger 11 視角、禁令、Teammate/Subagent 規則、TeamCreate 工作模式、PM 派任務模板、OpenSpec 流程。

## ⚠️ 開發規則（強制）

**所有開發規則定義在 `openspec/config.yaml`，無論是否使用 OpenSpec 流程都必須遵守。**

- **Skills**：所有 tp-* skills 透過 API 操作行程資料，不操作本地檔案
- **OpenSpec**：功能開發遵守 openspec 流程，除非使用者同意跳過
- **Agent / Sub Agent**：
  - Teammate 模型分層：**Opus**（Reviewer、Challenger）、**Sonnet**（Engineer、QC）
  - Subagent 預設 Sonnet，需判斷力時可升 Opus
  - 獨立任務盡量同時發送多個 Agent tool call
  - 長時間任務用 `run_in_background: true`
  - 多 agent 並行修改檔案時用 `isolation: "worktree"`

## 專案結構

```
index.html          setting.html        edit.html（redirect → /manage/）
manage/             index.html（旅伴請求頁）
admin/              index.html（權限管理頁）
src/
  entries/          main.tsx  setting.tsx  manage.tsx  admin.tsx（各頁 React 入口）
  pages/            TripPage.tsx  SettingPage.tsx  ManagePage.tsx  AdminPage.tsx
  components/trip/  Timeline  DayNav  Restaurant  Hotel  MapLinks  HourlyWeather  InfoPanel  SpeedDial  Footer ...
  components/shared/ Icon.tsx  StickyNav.tsx  TripSelect.tsx
  hooks/            useTrip.ts  useApi.ts  usePrintMode.ts  useDarkMode.ts
  lib/              mapRow.ts  localStorage.ts  sanitize.ts  constants.ts  weather.ts  drivingStats.ts
  types/            trip.ts  api.ts
css/                shared.css  style.css  setting.css  manage.css  admin.css（保持原生 CSS）
js/                 （舊版 vanilla JS，部分測試仍依賴，逐步移除中）
functions/api/      _middleware.ts  _audit.ts  trips.ts  requests.ts  permissions.ts  my-trips.ts
                    trips/[id].ts  trips/[id]/days.ts  days/[num].ts  docs/[type].ts
                    entries/[eid].ts  restaurants/[rid].ts  shopping/[sid].ts  ...
migrations/         0001_init.sql  0002_trips.sql
scripts/            migrate-md-to-d1.js  tp-check.js  daily-report.js  dump-d1.js  memory-sync.sh
                    register-scheduler.ps1  unregister-scheduler.ps1  tp-request-scheduler.ps1
backups/            D1 資料快照（dump-d1.js 產出，納入版控）
tests/              unit/  integration/  e2e/
openspec/           config.yaml（開發規則唯一來源）  specs/  changes/
vite.config.ts      Vite 多入口建置（4 個 HTML）
tsconfig.json       TypeScript strict mode
wrangler.toml       D1 database binding + pages_build_output_dir: dist
```

- Cloudflare Pages：https://trip-planner-dby.pages.dev/
- 資料庫：Cloudflare D1（trip-planner-db）

## 資料架構

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

## 認證架構

- **Cloudflare Access**：/manage/ + /admin/ + 寫入 API 受保護
- **Zero Trust 成員**：通過 Access 登入即可寫入行程
- **Admin**（lean.lean@gmail.com）：可管理權限、查看 audit log、rollback
- **Service Token**：tp-request CLI 用，等同 admin 權限

## D1 安全規則

**詳細規則定義在 `openspec/config.yaml` 的 `d1_safety` 區塊，以下為摘要。**

- **Migration 禁止 DROP TABLE** 被 FK ON DELETE CASCADE 引用的表 — D1 預設啟用 foreign_keys，DROP 會連鎖刪除所有子表資料
- **Migration 執行前必須先備份**：`node scripts/dump-d1.js` → `backups/{timestamp}/`
- **備份檔納入版控**，確保可追溯
- **還原優先用 D1 Time Travel**：`npx wrangler d1 time-travel restore trip-planner-db --timestamp <RFC3339>`

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
