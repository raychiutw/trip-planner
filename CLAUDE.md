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
  entries/          main.tsx（SPA 單一入口，BrowserRouter）
  pages/            TripPage.tsx  ManagePage.tsx  AdminPage.tsx
  components/trip/  Timeline  DayNav  Restaurant  Hotel  MapLinks  HourlyWeather  InfoPanel  QuickPanel  Footer ...
  components/shared/ Icon.tsx  Toast.tsx  RequestStepper.tsx  TriplineLogo.tsx  ErrorBoundary.tsx
  hooks/            useTrip.ts  useApi.ts  usePrintMode.ts  useDarkMode.ts
  lib/              mapRow.ts  mapDay.ts  mergePoi.ts  localStorage.ts  sanitize.ts  constants.ts  weather.ts  drivingStats.ts  appearance.ts
  types/            trip.ts  api.ts
css/                tokens.css（Tailwind CSS 4 @theme design tokens — 唯一 CSS 檔案）
js/                 （舊版 vanilla JS，部分測試仍依賴，逐步移除中）
functions/api/      _middleware.ts  _audit.ts  trips.ts  requests.ts  permissions.ts  my-trips.ts
                    trips/[id].ts  trips/[id]/days.ts  days/[num].ts  docs/[type].ts
                    entries/[eid].ts  entries/[eid]/trip-pois.ts  trip-pois/[tpid].ts  pois/[id].ts
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
  trips             行程主表（id, name, owner, title, self_drive, countries, ...）
  trip_days         天（trip_id FK, day_num, date, day_of_week, label）
  trip_entries      時間軸項目（day_id FK, sort_order, time, title, description, maps, google_rating, travel_*）
  pois              POI master（type, name, description, lat, lng, google_rating, hours, ...）— AI 維護，user 不可直接改
  trip_pois         行程 POI 引用（trip_id, poi_id, context, day_id, entry_id, 覆寫欄位 + 類型專屬欄位）
  poi_relations     POI 關聯（poi_id, related_poi_id, relation_type）— 停車場↔飯店 多對多
  trip_docs         附屬文件（trip_id, doc_type, content）— flights/checklist/backup/suggestions/emergency
  audit_log         修改審計（trip_id, table_name, action, diff_json, snapshot）
  trip_requests     旅伴請求（trip_id, mode, message, reply, status）
  trip_permissions  權限（email, trip_id, role）
  --- legacy（遷移後保留，不再使用）---
  hotels_legacy / restaurants_legacy / shopping_legacy
```

## API 端點

```
公開讀取（不需認證）：
  GET /api/trips                         行程列表
  GET /api/trips/:id                     行程 meta
  GET /api/trips/:id/days                所有天概要
  GET /api/trips/:id/days/:num           完整一天（pois + trip_pois JOIN）
  GET /api/trips/:id/docs/:type          附屬文件

需認證寫入（Zero Trust 成員或 Service Token）：
  POST   /api/trips                      建立行程（含 trip_days + permissions）
  PUT    /api/trips/:id                  更新 meta
  PUT    /api/trips/:id/days/:num        覆寫整天（find-or-create pois + insert trip_pois）
  PATCH  /api/trips/:id/entries/:eid     修改 entry
  DELETE /api/trips/:id/entries/:eid     刪除 entry（cascade delete trip_pois）
  POST   /api/trips/:id/entries/:eid/trip-pois  新增 POI 到 entry
  PATCH  /api/trips/:id/trip-pois/:tpid  修改 trip_pois（user 覆寫）
  DELETE /api/trips/:id/trip-pois/:tpid  刪除 trip_pois 引用
  PUT    /api/trips/:id/docs/:type       更新文件

旅伴請求（Access 認證）：
  GET  /api/requests?tripId=xxx          列出請求
  POST /api/requests                     送出請求
  PATCH /api/requests/:id                回覆 + 關閉

管理（僅 admin）：
  GET/POST/DELETE /api/permissions       權限 CRUD
  PATCH  /api/pois/:id                   修改 POI master（僅 admin）
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

### Chrome 手機版捲動彈回（已解決）

V2 cutover 後全部頁面使用 Tailwind inline + `tokens.css`，不再依賴 `shared.css` 的 `page-simple` class。
Admin/Manage 頁面使用獨立的 Tailwind layout，不會與行程頁的捲動設定衝突。


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
