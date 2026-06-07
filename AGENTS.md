# Tripline

Cloudflare Pages + D1 + React SPA + V2 OAuth. Admin: lean.lean@gmail.com.

## Pipeline (invoke `/tp-team` before code changes)

`Think → Plan → Build → Review → Test → Ship → Reflect`

- Think `/office-hours` · Plan `/autoplan` · Build code + `/simplify`
- Review `/tp-code-verify` + `/review` (mandatory)
- Test `/cso --diff` (mandatory) + `/qa`
- Ship `/ship` → `/land-and-deploy` → `/canary` · Reflect `/retro`

## Hard Rules (sync with CLAUDE.md)

- **Code change → invoke `/tp-team` first** (新功能、bug fix、refactor、migration、CSS、API endpoint)。行程資料用 `tp-*` data skills 直接打 API。
- **Mockup-first hard gate**：所有 new page / new component（≥1 layout 變化）→ `/tp-claude-design` 產 HTML mockup → user sign-off → 才寫 React。Bug fix / token drift / 純 prop tweak / 內部 refactor (無 UX 變化) 例外。
- Feature branch + PR via `/ship`. Never push master directly.
- `tp-*` skills hit API, not local files.
- Agent tool only for worktree isolation.
- Web browse: `/browse` only, never `mcp__claude-in-chrome__*`.
- Post-ship retroactive OpenSpec archive if PR didn't propose first.

## Naming history (sync from CLAUDE.md)

完整 30+ 歷史 bug + 對應修法見 [CLAUDE.md](CLAUDE.md) "Naming history"。重點:

- **v2.23.0+**: Google Maps Platform — OSM / Nominatim / Overpass / ORS / Haversine 全 ripped out，no fallback
- **v2.27.0+ (migration 0057+0058)**: `trip_entry_pois` junction table (1 entry × N POI: master sort_order=1 + alternates)
- **v2.29.x (migration 0061-0063)**: `trip_pois` 整表 + `saved_pois` 全 DROP，metadata 改 `pois` master / `trip_entry_pois` / `trip_days.hotel_poi_id`
- **v2.31.13-15-27 bug 家族**: camelCase 對齊 — backend `deepCamel` 回 camelCase，frontend type 寫 snake → 永遠讀 undefined → silent filter 0 result。**寫 type 前確認 backend response shape**
- **v2.33.5x-67**: 完整 code review sweep (rounds 1-17) — OAuth security / CSP / sqlite_sequence / vitest workspace / shared factory defer 等

## Layout

`src/` SPA · `functions/api/` Pages Functions · `migrations/` D1 · `tests/` · `css/tokens.css` Tailwind 4.

Desktop ≥1024px: 2-col timeline + sticky map. Mobile: 5-tab nav.

## Dev

```bash
npm run dev:init   # local SQLite
npm run dev        # vite 5173 + wrangler 8788
```

Mock auth: copy `.dev.vars.example` → `.dev.vars` (NOT `.env.local`), set all three of `ENVIRONMENT=development` + `ALLOW_DEV_MOCK=1` + `DEV_MOCK_EMAIL` (SEC-6 fail-closed guard; 缺一 → `/api/*` 全 500). See `.dev.vars.example`.
Prod `TRIPLINE_API_URL`: funnel listens `:443`, not `:8443`.

## Design SoT

`DESIGN.md` + `docs/design-sessions/terracotta-preview-v2.html` are UI/UX truth. Code mismatch = bug. Conflict → discuss first.

## Skill Routing

Match → invoke `Skill` first.

- Brainstorm → `/office-hours` · Bug → `/investigate`
- Ship/PR → `/ship` · QA → `/qa` · Code review → `/review`
- Doc sync post-ship → `/document-release`
- Visual → `/design-review` · Architecture → `/plan-eng-review`
- Browse → `/browse`

Detail: `ARCHITECTURE.md`, `GEMINI.md`, `DESIGN.md`, `.claude/skills/tp-team/SKILL.md`.
Prod: https://trip-planner-dby.pages.dev/ · GBrain: pglite, see `~/.gbrain/config.json`.
