# Tripline

Cloudflare Pages + D1 + React SPA + V2 OAuth. 無全域 admin — owner/permissions + service-token ops scope 授權（admin 移除 v2.55.5-v2.55.7）。

## Pipeline

`Think → Plan → Build → Review → Test → Ship → Reflect`

- Think `/office-hours` · Plan `/autoplan` · Build code + `/simplify`
- Review `/tp-code-verify` + `/review` (mandatory)
- Test `/cso --diff` (mandatory) + `/qa`
- Ship `/ship` → `/land-and-deploy` → `/canary` · Reflect `/retro`

## Hard Rules

- **Code change → invoke `/tp-team` first** (新功能、bug fix、refactor、migration、CSS、API endpoint)。行程資料用 `tp-*` data skills 直接打 API。
- **Mockup-first hard gate**：所有 new page / new component（≥1 layout 變化）→ `/tp-claude-design` 產 HTML mockup → user sign-off → 才寫 React。Bug fix / token drift / 純 prop tweak 例外。
- Feature branch + PR via `/ship`. Never push master directly.
- `tp-*` skills hit API, not local files.
- Agent tool only for worktree isolation.
- Web browse: Chrome MCP (`mcp__claude-in-chrome__*`) 或 `/browse` 皆可（owner 2026-07-23 解除 /browse-only 限制）。
- Post-ship retroactive OpenSpec archive if PR didn't propose first.

## Layout

`src/` SPA · `functions/api/` Pages Functions · `migrations/` D1 · `tests/` · `css/tokens.css` Tailwind 4.

Desktop ≥1024px: 2-col timeline + sticky map. Mobile: 4-tab nav（聊天/行程/地圖/收藏）+ 帳號 header 圓圈 → Account sheet（HIG，見 `docs/plans/apple-hig-compliance/`）。

## Dev

```bash
npm run dev:init   # local SQLite
npm run dev        # vite 5173 + wrangler 8788
```

Mock auth: copy `.dev.vars.example` → `.dev.vars` (NOT `.env.local`), set all three of `ENVIRONMENT=development` + `ALLOW_DEV_MOCK=1` + `DEV_MOCK_EMAIL` (SEC-6 fail-closed guard; 缺一 → `/api/*` 全 500). See `.dev.vars.example`.
Prod `TRIPLINE_API_URL`: funnel listens `:443`, not `:8443`.

## Design SoT

**Apple HIG 是 UI/UX SoT**（iOS 手機 / macOS 桌機：IA、互動、色彩、材質、a11y）。`DESIGN.md` 為衍生、須對齊 HIG；code 不符＝bug，衝突以 HIG 為準（先討論再改 `DESIGN.md`）。**品牌保留例外**：terracotta 受控 tint / Inter web font / timeline editorial no-glass —— HIG 允許，不對齊。合規計畫（spec + 16 W-tickets）見 `docs/plans/apple-hig-compliance/`。此 effort 不使用 mockup 流程。

## Skill Routing

Match → invoke `Skill` first.

- Brainstorm → `/office-hours` · Bug → `/investigate`
- Ship/PR → `/ship` · QA → `/qa` · Code review → `/review`
- Doc sync post-ship → `/document-release`
- Visual → `/design-review` · Architecture → `/plan-eng-review`
- Browse → `/browse`

Detail: `ARCHITECTURE.md`, `GEMINI.md`, `DESIGN.md`, `.claude/skills/tp-team/SKILL.md`.
Prod: https://trip-planner-dby.pages.dev/ · GBrain: pglite + MCP (user scope), sync=full, repo=read-write, 873 pages, setup 2026-05-04. Windows caveat: transcript ingest no-op (script POSIX-only). See `~/.gbrain/config.json`.

## Agent skills

### Issue tracker

Issues 走 GitHub Issues（`raychiutw/trip-planner`），用 `gh` CLI；`/wayfinder` 的 map / child ticket / blocking 也落在這。See `docs/agents/issue-tracker.md`.

### Triage labels

五個角色用預設名稱（`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`）；`wontfix` 沿用 repo 既有標籤。See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — 根目錄 [`CONTEXT.md`](CONTEXT.md)（領域詞彙 + 已退場名字）+ [`docs/adr/`](docs/adr/)（架構決策，`ARCHITECTURE.md` 只留索引）。探索程式碼前先讀。See `docs/agents/domain.md`.
