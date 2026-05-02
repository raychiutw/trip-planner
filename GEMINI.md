# Tripline

## Project Overview

Tripline is a travel itinerary web app: viewing, editing, and sharing trips with collaborators. Backed by Cloudflare D1 (SQLite on the edge) for trip data, served as a React SPA via Cloudflare Pages.

### Technologies
- **Frontend**: React 19 + TypeScript + Vite, Tailwind CSS 4 (`css/tokens.css` `@theme` 為唯一 CSS 入口)。
- **Routing**: React Router v6 (`BrowserRouter`, SPA 單入口 `src/entries/main.tsx`)。
- **Backend**: Cloudflare Pages Functions (`functions/api/*.ts`, Workers runtime)。
- **Database**: Cloudflare D1 (SQLite on the edge), schema in `migrations/`。
- **Auth**: V2 OAuth self-built (`tripline_session` HMAC opaque cookie + `/api/oauth/*` endpoints)。Cloudflare Access **已 V2-P6 完全拆除**。
- **Build**: Vite (SPA bundle into `dist/`), Wrangler (Pages 本機模擬 + 部署)。
- **Testing**: Vitest + @testing-library/react (unit / integration), Playwright (e2e), Miniflare (API integration)。
- **Observability**: Sentry (Vite plugin + runtime), `api_logs` D1 table。
- **CI/CD**: GitHub Actions + Cloudflare Pages auto-deploy on master push。

## Directory Structure

- `src/entries/main.tsx`: SPA 單入口，BrowserRouter 註冊所有 routes。
- `src/pages/`: TripsListPage (主入口 `/trips`)、TripPage (embedded)、MapPage、ChatPage、ExplorePage、AccountPage、Auth pages 等。
- `src/components/`: `trip/` (Timeline / DayNav / Restaurant / TripMapRail 等)、`shared/` (Icon / Toast / ConfirmModal 等)、`shell/` (AppShell / DesktopSidebar / GlobalBottomNav)。
- `src/contexts/`: NewTripContext, ActiveTripContext, TripIdContext, TripDaysContext。
- `src/hooks/`: useTrip, useApi, useDarkMode, useRequireAuth, useCurrentUser 等。
- `src/lib/`: mapRow, mapDay, mergePoi, localStorage, sentry, drag-strategy。
- `css/tokens.css`: 唯一 CSS source — Tailwind CSS 4 `@theme` 定義 V2 Terracotta 單主題 tokens (color / radius / spacing / typography)。
- `functions/api/`: Cloudflare Pages Functions (TS) — RESTful nested routes：`trips/`, `pois/`, `requests/`, `permissions/`, `account/`, `oauth/` 等。
- `migrations/`: D1 SQL schema (0001 ~ 0042+，含 `rollback/`)。
- `scripts/`: `init-local-db`, `dump-d1`, `daily-check`, `migrate-pois`, `tp-check` 等運維腳本。
- `tests/`: `unit/`, `integration/`, `e2e/`, `api/`。
- `docs/design-sessions/terracotta-preview-v2.html`: **canonical mockup** (UI/UX source of truth)。
- `openspec/`: `config.yaml` + `specs/` + `changes/` (OpenSpec workflow)。

## Building and Running

### Local Dev (vite + wrangler)
```bash
npm run dev:init     # 一鍵建本機 SQLite (only first time)
npm run dev          # vite (5173) + wrangler pages dev (8788) 並行
```
Open `http://localhost:5173/`. Vite proxy `/api/*` to wrangler 8788。

### Production Build
```bash
npm run build        # vite build → dist/
```
Cloudflare Pages 自動 deploy on master push (`pages-build-deployment` workflow)。

### Testing
```bash
npm run test                # vitest run (unit + integration)
npm run test:watch          # vitest watch
npm run test:e2e            # Playwright e2e
```

## Development Conventions

- **Data Modification**: 行程資料透過 API operations 修改 (PATCH `/api/trips/:id/entries/:eid`, POST `/api/trips/:id/entries`)。tp-* skills 用 API 不操作本地檔。
- **POI Master + Per-trip overrides**: `pois` 是 AI 維護 master，`trip_pois` allow user override (NULL = 繼承 master via COALESCE)。
- **UI Design**: 遵守 `DESIGN.md` (V2 Terracotta 單一 accent #D97848 + #FFFBF5 cream bg + 暖色有機風 + Apple HIG)。Mockup `docs/design-sessions/terracotta-preview-v2.html` 是 canonical source。
- **Mockup + DESIGN.md = single source of truth**: 衝突先討論 (見 CLAUDE.md Design System section)，無衝突必須完全遵守，禁止沉默偏離。
- **CSS Architecture**: 全部走 Tailwind utility class + `tokens.css` `@theme` tokens。Scoped styles 只在 component-level 用 `<style>{SCOPED_STYLES}</style>` 處理 pseudo-element / dark mode 例外。
- **Auth**: V2 OAuth (`tripline_session` cookie / Bearer token)。本機開發用 `.dev.vars` 的 `DEV_MOCK_EMAIL` (wrangler 讀此檔，**不是** `.env.local`)。
- **Git Commits**: 走 7 階段 gstack pipeline (Think → Plan → Build → Review → Test → Ship → Reflect)。code 變更用 feature branch + `/ship` 自動建 PR (禁止直接 push master)。Commit messages 用繁體中文。
- **Language**: 繁體中文 (Taiwan)。
- **OpenSpec Workflow**: 新功能走 OpenSpec (`openspec/config.yaml`) — propose → design → specs → tasks → implement。

## Agent Skills

`.claude/skills/` 內 trip-planner 專屬 skill (前綴 `tp-`)：
- `tp-team`: code 變更前的 pipeline 入口。
- `tp-create`: 從零建新行程。
- `tp-edit`: 局部修改既有行程。
- `tp-rebuild`: 重整行程品質 (R0-R18 規則)。
- `tp-check`: 驗證行程品質，輸出紅綠燈報告 (唯讀)。
- `tp-patch`: 批量補齊 POI 欄位 (跨行程)。
- `tp-request`: 處理旅伴請求 (D1 queue)。
- `tp-daily-check`: 每日健康檢查 + 自動修復 + Telegram 通知。
- `tp-code-verify`: commit 前驗證 code (命名 / React / CSS HIG / 測試)。
- `tp-claude-design`: 從零產新視覺 artifact (新 page / component / mockup)。

詳見 `CLAUDE.md` Sprint Pipeline section。
