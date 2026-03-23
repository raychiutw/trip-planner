# 行程規劃網站（trip-planner）

## 團隊協作

本專案有 10 個角色：**Key User** (使用者) → **PM** (Claude) → 8 專責 Teammate

| 常駐角色 | 模型 | gstack 技能 |
|---------|------|-------------|
| **Architect**（架構師） | Opus | `/plan-eng-review` `/plan-ceo-review` |
| **Designer**（設計師） | Opus | `/design-consultation` `/plan-design-review` `/design-review` |
| **Engineer**（工程師） | Sonnet | — |
| **Reviewer**（審查員） | Opus | `/review` `/codex` |
| **QA**（品質保證） | Sonnet | `/qa` `/qa-only` `/browse` `/benchmark` |
| **Security**（安全官） | Opus | `/cso` |

| 按需角色 | 模型 | gstack 技能 |
|---------|------|-------------|
| **DevOps**（部署運維） | Sonnet | `/ship` `/land-and-deploy` `/canary` |
| **Debugger**（除錯專家） | Opus | `/investigate` |

- **涉及 code 變更的任務都用 Team 處理**，確保每個改動都經過完整審查流程。行程資料操作（tp-* skill）PM 直接操作，不建 Team。
- PM 禁止改 code、跑測試、debug。要改 code 必須派 Engineer Teammate。
- 派 Teammate 或團隊協作時，PM 必須先 **invoke `/tp-team`** 載入完整團隊規則。
- `/tp-team` 包含：權責矩陣、專責角色質疑視角、禁令、Teammate/Subagent 規則、TeamCreate 工作模式、PM 派任務模板、OpenSpec 流程。

## ⚠️ Git Push 管控（強制）

- **`git push` 必須經 Key User 明確同意**，由 PreToolUse hook 強制攔截
- 同意方式（二擇一）：
  1. **Telegram**：Key User 在 Telegram 回覆同意（approve/同意/好/可以等）
  2. **CLI**：Key User 在 CLI 輸入同意（我同意/同意/approve/push 等）
- 收到同意後，PM 建立 `.push-approved` 旗標檔案，再重新執行 `git push`
- Hook 看到旗標 → 放行 → 旗標自動刪除（一次性）
- **嚴禁繞過此機制**（不得刪除 hook、不得手動 push）

### 團隊開發完成流程

完整流程定義在 `.claude/skills/tp-team/references/workflow.md`，摘要：

1. **Commit**：每個 change 完成團隊流程後 commit（**不 push**）
2. **進度報告**：向 Key User 提出完成摘要 + tasks 勾選 + Reviewer/QA/Security 結果 + 忽略項目
3. **🔑 Key User 第一次 Approve**：審閱報告後回覆同意 push
4. **Push**：`git push` feature branch（hook 確認 → Key User 同意放行）
5. **PR + CI**：開 PR → GitHub Actions 自動跑 CI（tsc + test + build + verify-sw）
6. **CI 結果回報**：PM 回報 CI 結果給 Key User
7. **🔑 Key User 第二次 Approve**：同意 merge PR
8. **Merge**：PM 執行 `gh pr merge` → production deploy
- **⚠️ PM 禁止自動 merge PR** — 必須等 Key User 明確同意 merge 才能執行

## Long-running Session Protocol

**核心理念：Long-running 不是一個 session 跑很久，是交接零成本。**

每個 session 都是無狀態的。存活的不是對話，是 artifacts。

### 三個失敗模式（必須防堵）

1. **One-shot 燒完 context** — Agent 嘗試一次做完所有事 → context 中途燒完 → 下一個 session 接手半成品爛攤子
2. **提早下班** — 後面的 Agent 看到前面有進度 → 直接宣布完成
3. **假完成** — Agent 跑個 unit test 就標 done → 但 E2E 根本是壞的

### Initializer + Coding Agent 架構

#### Initializer Session（PM 建 change 時執行）

PM 建立 OpenSpec change 後，除了 `proposal.md` / `design.md` / `tasks.md`，還要產出：

```
openspec/changes/{change-name}/
  features.json        ← 機器可讀的 feature checklist（JSON，不是 markdown！）
  progress.jsonl       ← 交班日誌（append-only，每 session 一行）
  init.sh              ← 開機腳本（環境恢復 + smoke test）
```

#### features.json（JSON，不准用 markdown）

**為什麼是 JSON 不是 markdown？** Agent 會偷改 markdown 結構（移除 checkbox、改標題層級、合併項目）。JSON schema 是硬性約束，改了就 parse error。

```json
{
  "change": "change-name",
  "created": "2026-03-23",
  "features": [
    {
      "id": "F001",
      "title": "功能描述",
      "priority": 1,
      "status": "pending",
      "session": null,
      "e2e": false
    }
  ]
}
```

**status 只有三種值**：`pending` / `done` / `blocked`
**e2e 必須是 true 才算完成** — unit test pass 不算

#### progress.jsonl（交班日誌，append-only）

每個 session 結束時 append 一行，不准編輯歷史行。

```jsonl
{"session":1,"ts":"2026-03-23T10:00Z","type":"init","done":0,"total":12,"commit":"abc1234","notes":"Initialized change"}
{"session":2,"ts":"2026-03-23T11:30Z","type":"coding","feature":"F001","result":"done","e2e":"pass","smoke":"pass","commit":"def5678","notes":"Added dark mode toggle"}
{"session":3,"ts":"2026-03-23T14:00Z","type":"coding","feature":"F002","result":"blocked","e2e":"skip","smoke":"pass","commit":null,"notes":"Blocked: API endpoint not ready"}
```

#### init.sh（開機腳本）

```bash
#!/bin/bash
set -e
npm ci
npx tsc --noEmit          # 型別檢查 — 確認前一個 session 沒留下爛攤子
npm test                  # 單元測試 — 確認 baseline 是綠的
npm run build             # build — 確認能編譯
echo "✅ Smoke test passed — app is healthy"
```

### Coding Agent Session Protocol（每個 Engineer session 的 7 步）

```
1. 📖 讀交班日誌    → cat progress.jsonl + git log --oneline -20
2. 📋 選下一個 feature → 讀 features.json，找 status=pending + 最高 priority
3. 🔧 跑 init.sh      → 確認 app 還活著（smoke test）
4. ⚠️ smoke 失敗？    → 先修到綠，不要開始新 feature
5. 🏗️ 實作一個 feature → 只做一個，不做多個
6. ✅ E2E 驗證        → 不只 unit test，要真的跑起來驗
7. 💾 收尾            → git commit + 更新 features.json + append progress.jsonl
```

**鐵律：一個 session 只做一個 feature。** 做完一個、驗完一個、交班一個。
context 沒燒完不代表要繼續塞 — 保留乾淨的交班狀態比多做一個 feature 重要。

### 與現有流程的整合

| 現有 artifact | Long-running artifact | 關係 |
|--------------|----------------------|------|
| `tasks.md`（markdown checkbox） | `features.json`（JSON） | 雙軌：tasks.md 給人看，features.json 給 agent 讀 |
| `notes.md`（決策/踩坑） | `progress.jsonl`（session 日誌） | 互補：notes.md 記「為什麼」，progress.jsonl 記「做了什麼」 |
| git log | git log | 同一個，不重複 |
| `.workflow-stage` | 不變 | 流程追蹤仍用 workflow-stage |

## CI/CD 流程

1. **建立 feature branch**：改檔案前先從 master 建立新分支，所有開發一律在 feature branch，不直接 push master
2. **開發 + Commit**：在 feature branch 上開發、commit
3. **Push**：Key User 同意後 push feature branch
4. **開 PR**：對 master 開 PR
5. **GitHub Actions CI**（`.github/workflows/ci.yml`）：PR 觸發，執行 tsc + unit test + build + verify-sw
   - **SW 驗證**：`scripts/verify-sw.js` 驗證 `dist/sw.js` 的 6 項規則（no NavigationRoute、has precacheAndRoute 等）
   - 本地執行：`npm run verify-sw`
6. **Cloudflare Preview Deploy**：feature branch push 後自動部署 Preview URL（不受 Access 保護，方便測試）
7. **CI 全綠 + review** → merge master
8. **Production Deploy**：merge master 後自動部署至 https://trip-planner-dby.pages.dev/

## ⚠️ 開發規則（強制）

**所有開發規則定義在 `openspec/config.yaml`，無論是否使用 OpenSpec 流程都必須遵守。**

- **Skills**：所有 tp-* skills 透過 API 操作行程資料，不操作本地檔案
- **OpenSpec**：功能開發遵守 openspec 流程，除非使用者同意跳過
- **Agent / Sub Agent**：
  - Teammate 模型分層：**Opus**（Architect、Designer、Reviewer、Security、Debugger）、**Sonnet**（Engineer、QA、DevOps）
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
