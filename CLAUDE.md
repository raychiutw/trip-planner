# Tripline — 行程共享網站

## gstack Sprint Pipeline

**Claude 直接做事，invoke 不同 gstack skill 換帽子。** code 變更前 invoke `/tp-team`。

```
Think → Plan → Build → Review → Test → Ship → Reflect
```

| 階段 | gstack skill | 做什麼 |
|------|-------------|--------|
| Think | `/office-hours` | 探索需求（新功能/架構跑） |
| Plan | `/autoplan` | CEO + Eng + Design 三審 |
| Build | 寫 code + `/simplify` | TDD + 精簡 |
| Review | `/tp-code-verify` → `/review` | 專案規範 + diff 審查 ← 不可跳過 |
| Test | `/cso --diff` + `/qa` | 安全掃描 + QA ← `/cso --diff` 不可跳 |
| Ship | `/ship` → `/land-and-deploy` → `/canary` | PR + merge + 監控 |
| Reflect | `/retro` | 回顧（weekly） |

## CI/CD

1. Feature branch → 2. TDD → 3. `/ship`（PR） → 4. CI（tsc + test + build） → 5. `/land-and-deploy`（merge） → 6. `/canary` → 7. Production（https://trip-planner-dby.pages.dev/）

## ⚠️ 開發規則（強制）

**規則定義在 `openspec/config.yaml`，無論是否使用 OpenSpec 流程都必須遵守。**

- tp-* skills 透過 API 操作行程資料，不操作本地檔案
- code 變更走 7 階段 pipeline
- Agent 只用於 worktree 隔離，不用於角色派遣
- 若 PR 未走 OpenSpec propose，ship 後須補 retroactive archive（參考 `openspec/changes/archive/2026-04-21-design-review-v2-retrofit/`）

## 專案結構

```
src/entries/        main.tsx（SPA 單入口，BrowserRouter）
src/pages/          TripPage  ManagePage（AI 編輯聊天）  AdminPage
src/components/     trip/（Timeline DayNav DaySection TripMapRail ...）  shared/（Icon Toast ErrorBoundary ...）
src/hooks/          useTrip  useApi  useDarkMode  usePrintMode  useOnlineStatus ...
src/lib/            mapRow  mapDay  mergePoi  localStorage  sentry  weather ...
src/types/          trip.ts  api.ts
css/                tokens.css（Tailwind CSS 4 @theme — 唯一 CSS，含 6 套主題）
functions/api/      _middleware  _auth  _audit  _utils  _validate  _types
                    trips/  pois/  requests/  permissions/（RESTful nested routes）
migrations/         0001 ~ 0026（D1 schema，含 rollback/）
scripts/            init-local-db  dump-d1  daily-check  migrate-pois  tp-check ...
tests/              unit/  integration/  e2e/
openspec/           config.yaml  specs/  changes/
```

- Cloudflare Pages + D1（trip-planner-db / staging）
- 設計系統：`DESIGN.md`（暖色有機風、Apple HIG、6 套主題）
- **Desktop 2-col layout（≥1024px）**：`grid-template-columns: clamp(375px, 30vw, 400px) 1fr`，左欄行程 timeline，右欄 `TripMapRail` sticky Leaflet 地圖；`<1024px` 單欄 mobile-first
- **MobileBottomNav 4-tab IA（≤760px）**：`行程 / 地圖 / 訊息 / 更多`，全部 route-based（`/trip/:id` / `/trip/:id/map` / `/manage` / action-menu sheet）
- **Day palette**：10 色 Tailwind -500（sky/teal/amber/rose/violet/lime/orange/cyan/fuchsia/emerald）用於地圖 polyline，對應 DESIGN.md Data Visualization 例外；UI chrome 仍嚴守 Ocean 單一 accent

## 資料架構（POI Schema）

```
trips → trip_days → trip_entries        時間軸結構
pois（AI 維護 master）→ trip_pois（user 覆寫）→ poi_relations（多對多）
trip_docs  audit_log  api_logs  trip_requests  trip_permissions
```

POI 資料所有權：`pois` = AI 維護，`trip_pois` = user 可覆寫（COALESCE convention：NULL = 繼承 master）

## 認證

- **Cloudflare Access**：/manage/ + /admin/ + 寫入 API
- **Admin**：lean.lean@gmail.com
- **Mock Auth**（本機）：`.dev.vars` 的 `DEV_MOCK_EMAIL`（wrangler 只讀這檔，**不是** `.env.local`）
  - 複製：`cp .dev.vars.example .dev.vars` → 改 email → 重啟 `npm run dev`
  - 沒設會讓 `/manage` 拿 401「無法存取」

## 本機開發

```bash
npm run dev:init     # 一鍵建本機 SQLite
npm run dev          # vite (5173) + wrangler (8788)
```

## Design System

所有視覺決定參照 `DESIGN.md`。修改 UI 必須對照，QA 模式下標記不符項。

## gstack

**網頁瀏覽一律用 `/browse`，不用 `mcp__claude-in-chrome__*`。**

常用：`/office-hours` `/autoplan` `/review` `/codex` `/qa` `/cso` `/ship` `/land-and-deploy` `/canary` `/retro` `/browse` `/design-review` `/investigate` `/benchmark`

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
