# Tripline — 行程共享網站

## gstack Sprint Pipeline

**Claude 直接做事，invoke 不同 gstack skill 換帽子。** code 變更前 invoke `/tp-team`。

```
Think → Plan → Build → Review → Test → Ship → Reflect
```

| 階段 | gstack skill | 做什麼 |
|------|-------------|--------|
| Think | `/office-hours` | 探索需求（選用） |
| Plan | `/autoplan` | CEO + Eng + Design 三審 |
| Build | 寫 code + `/simplify` | TDD + 精簡 |
| Review | `/review` → `/codex` | 審查 + cross-model |
| Test | `/qa` → `/cso` → `/benchmark` | E2E + 安全 + 效能 |
| Ship | `/ship` → `/land-and-deploy` → `/canary` | PR + merge + 監控 |
| Reflect | `/retro` → archive | 回顧 + 歸檔 |

## CI/CD

1. Feature branch → 2. TDD → 3. `/ship`（PR） → 4. CI（tsc + test + build） → 5. `/land-and-deploy`（merge） → 6. `/canary` → 7. Production（https://trip-planner-dby.pages.dev/）

## ⚠️ 開發規則（強制）

**規則定義在 `openspec/config.yaml`，無論是否使用 OpenSpec 流程都必須遵守。**

- tp-* skills 透過 API 操作行程資料，不操作本地檔案
- code 變更走 7 階段 pipeline
- Agent 只用於 worktree 隔離，不用於角色派遣

## 專案結構

```
src/entries/        main.tsx（SPA 單入口，BrowserRouter）
src/pages/          TripPage  ManagePage  AdminPage
src/components/     trip/（Timeline DayNav Hotel ...）  shared/（Icon Toast ErrorBoundary ...）
src/hooks/          useTrip  useApi  useDarkMode  usePrintMode  useOnlineStatus ...
src/lib/            mapRow  mapDay  mergePoi  localStorage  sentry  weather ...
src/types/          trip.ts  api.ts
css/                tokens.css（Tailwind CSS 4 @theme — 唯一 CSS，含 6 套主題）
functions/api/      _middleware  _auth  _audit  _utils  _validate  _types
                    trips/  pois/  requests/  permissions/（RESTful nested routes）
migrations/         0001 ~ 0016（D1 schema）
scripts/            init-local-db  dump-d1  daily-check  migrate-pois  tp-check ...
tests/              unit/  integration/  e2e/
openspec/           config.yaml  specs/  changes/
```

- Cloudflare Pages + D1（trip-planner-db / staging）
- 設計系統：`DESIGN.md`（暖色有機風、Apple HIG、6 套主題）

## 資料架構（POI Schema V2）

```
trips → trip_days → trip_entries        時間軸結構
pois（AI 維護 master）→ trip_pois（user 覆寫）→ poi_relations（多對多）
trip_docs  audit_log  api_logs  trip_requests  trip_permissions
```

POI 資料所有權：`pois` = AI 維護，`trip_pois` = user 可覆寫（COALESCE convention：NULL = 繼承 master）

## 認證

- **Cloudflare Access**：/manage/ + /admin/ + 寫入 API
- **Admin**：lean.lean@gmail.com
- **Mock Auth**（本機）：`.env.local` 的 `DEV_MOCK_EMAIL`

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
