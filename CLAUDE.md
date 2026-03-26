# Tripline — 行程共享網站

## gstack Sprint Pipeline

**Claude 直接做事，invoke 不同 gstack skill 換帽子。** 沒有 PM、沒有 Agent 派遣。
code 變更前 invoke `/tp-team` 確認 pipeline。

### 7 階段 Pipeline

```
Think → Plan → Build → Review → Test → Ship → Reflect
```

| 階段 | gstack skill | 做什麼 |
|------|-------------|--------|
| Think | `/office-hours` | 探索需求（選用） |
| Plan | `/autoplan` | CEO + Eng + Design 三審 |
| Build | 寫 code + `/simplify` | TDD + 程式碼精簡 |
| Review | `/review` → `/codex` | 程式碼審查 + cross-model 驗證 |
| Test | `/qa` → `/cso` → `/benchmark` | E2E 測試 + 安全掃描 + 效能基準 |
| Ship | `/ship` → `/land-and-deploy` → `/canary` | push + PR + merge + 部署監控 |
| Reflect | `/retro` → archive | 回顧 + 歸檔 |

完整規則：`.claude/skills/tp-team/SKILL.md` + `references/stage-*.md`

### Long-running（多 session 交班）

大功能跨 session 時使用 `features.json` + `progress.jsonl` + `init.sh` 交班。
詳見 `.claude/skills/tp-team/references/long-running.md`

## CI/CD 流程

1. **Feature branch**：從 master 建新分支
2. **開發 + Commit**：TDD + `/simplify`
3. **`/ship`**：自動 push + 建 PR
4. **GitHub Actions CI**（PR 觸發）：tsc + test + build + verify-sw
5. **`/land-and-deploy`**：merge PR（唯一人類確認卡點）→ 部署驗證
6. **`/canary`**：部署後金絲雀監控
7. **Production**：merge master 後自動部署至 https://trip-planner-dby.pages.dev/

## ⚠️ 開發規則（強制）

**所有開發規則定義在 `openspec/config.yaml`，無論是否使用 OpenSpec 流程都必須遵守。**

- **Skills**：所有 tp-* skills 透過 API 操作行程資料，不操作本地檔案
- **OpenSpec**：功能開發遵守 openspec 流程，除非使用者同意跳過
- **gstack**：code 變更走 7 階段 pipeline（Think → Plan → Build → Review → Test → Ship → Reflect）
- **Agent**：只在需要 worktree 隔離（並行修改檔案）時才用 Agent，不用於角色派遣

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

### Chrome 手機版捲動彈回（非行程頁）

**問題**：非行程頁（設定、Admin）在 Chrome 手機版捲到底部會彈回頂部。

**根因**：`shared.css` 的捲動基礎設施為行程頁設計，與簡單頁面結構在 Chrome 合成層計算中衝突。

**解法**（`css/shared.css` 的 `.page-simple` class）：

```css
html.page-simple { scroll-behavior: auto; scrollbar-gutter: auto; overflow: visible; overscroll-behavior: none; }
.page-simple { max-width: none; overflow: visible; }
.page-simple .page-layout { display: block; min-height: 0; }
.page-simple .container { transition: none; }
.page-simple .sticky-nav { position: relative; }
```

在 HTML 加上 `<html class="page-simple">` + `<body class="page-simple">`。
設定頁另外在 `setting.css` 覆寫 `.page-simple .sticky-nav { position: sticky }` 保留 sticky 行為。

**教訓**：新增頁面時，若結構與行程頁差異大，在 HTML 加 `page-simple` class 即可。


## gstack

**所有網頁瀏覽一律使用 gstack 的 `/browse` 技能，切勿使用 `mcp__claude-in-chrome__*` 工具。**

可用技能：

| 技能 | 用途 |
|------|------|
| `/office-hours` | 腦力激盪新點子 |
| `/plan-ceo-review` | 策略層面計畫審查 |
| `/plan-eng-review` | 架構層面計畫審查 |
| `/plan-design-review` | 設計層面計畫審查 |
| `/design-consultation` | 建立設計系統 |
| `/review` | PR code review |
| `/ship` | 建立 PR 並準備部署 |
| `/land-and-deploy` | Merge PR + 部署驗證 |
| `/canary` | 部署後金絲雀監控 |
| `/benchmark` | 效能基準測試 |
| `/browse` | 無頭瀏覽器測試與截圖 |
| `/qa` | 系統化 QA 測試並修 bug |
| `/qa-only` | 僅產出 QA 報告不修改 |
| `/design-review` | 視覺設計稽核 |
| `/setup-browser-cookies` | 匯入瀏覽器 cookie |
| `/setup-deploy` | 設定部署組態 |
| `/retro` | 每週工程回顧 |
| `/investigate` | 系統化除錯 |
| `/document-release` | 發布後文件更新 |
| `/codex` | Codex 第二意見 / 對抗式 review |
| `/cso` | 安全稽核（OWASP / STRIDE） |
| `/autoplan` | 自動執行全部計畫審查 |
| `/careful` | 破壞性指令安全護欄 |
| `/freeze` | 限制編輯範圍至指定目錄 |
| `/guard` | 最大安全模式 |
| `/unfreeze` | 解除編輯限制 |
| `/gstack-upgrade` | 升級 gstack 至最新版 |
