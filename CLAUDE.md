# Tripline

Cloudflare Pages + D1 + React SPA + V2 OAuth. Admin: lean.lean@gmail.com.

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
- Web browse: `/browse` only, never `mcp__claude-in-chrome__*`.
- Post-ship retroactive OpenSpec archive if PR didn't propose first.

## Layout

`src/` SPA · `functions/api/` Pages Functions · `migrations/` D1 · `tests/` · `css/tokens.css` Tailwind 4.

Desktop ≥1024px: 2-col timeline + sticky map. Mobile: 5-tab nav.

## Dev

```bash
npm run dev:init   # local SQLite
npm run dev        # vite 5173 + wrangler 8788
```

Mock auth: copy `.dev.vars.example` → `.dev.vars` (NOT `.env.local`), set `DEV_MOCK_EMAIL`.
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
Prod: https://trip-planner-dby.pages.dev/ · GBrain: pglite + MCP (user scope), sync=full, repo=read-write, 873 pages, setup 2026-05-04. Windows caveat: transcript ingest no-op (script POSIX-only). See `~/.gbrain/config.json`.

## Naming history

- **v2.23.0** (migration 0051): Google Maps Platform 全套切換（OSM Nominatim + Mapbox + ORS + Leaflet + Haversine 全部 ripped out，no fallback）。`pois.osm_id` (number) → `pois.place_id` (string Google ChIJ id) + 4 lifecycle cols (`status` active/closed/missing + `status_reason` + `status_checked_at` + `last_refreshed_at`)。新表 `pois_search_cache`（24h TTL）+ `app_settings`（kill switch state + 90/50 hysteresis thresholds）。`functions/api/poi-search.ts` Nominatim → Google Places Text Search；`route.ts` Mapbox → Google Routes API；`OceanMap.tsx` Leaflet → Google Maps JS API（300-500KB lazy-loaded with `<MapSkeleton>` placeholder）。新 admin endpoints `/api/admin/{maps-lock,maps-unlock,backfill-status,maps-settings,quota-estimate,pois-pending-place-id,pois-due-refresh}.ts`。新 `/api/trips/:id/health` 給 `<TripHealthBanner>`。新 React 元件 `<PoiStatusBadge>` / `<TripHealthBanner>` / `<MapSkeleton>`。3 個 mac mini cron scripts（`google-poi-initial-backfill` / `google-poi-refresh-30d` / `google-quota-monitor`）+ npm scripts `backfill:google` / `refresh:google` / `quota:google`。tp-* SKILL.md (11 個檔 × .claude + .codex = 22 syncs) 改用 Place Details API（canonical curl block 在 `tp-shared/references/poi-spec.md`）。Hard cutover, no aliases.

- **v2.22.0** (migration 0050): `saved_pois` table → `poi_favorites`; `/saved` route → `/favorites`; `/api/saved-pois` → `/api/poi-favorites`; `SavedPoisPage` → `PoiFavoritesPage`; `AddSavedPoiToTripPage` → `AddPoiFavoriteToTripPage`. Hard cutover, no aliases. CSS class `tp-saved-*` → `tp-favorites-*`. Cross-skill auth header CF-Access → `Authorization: Bearer $TRIPLINE_API_TOKEN`.
- **v2.21.3** (migration 0049): `trip_requests.mode` column DROPPED. tp-request skill auto-classifies intent.
- **v2.21.2** (migration 0048): `trip_requests.mode` 改 nullable + drop CHECK constraint (phase 1 of mode rip-out).
- **v2.21.0** (migration 0046+0047): `trip_ideas` → `saved_pois` universal pool; `trips.owner_email` → `owner_user_id`; `saved_pois.email` / `trip_permissions.email` DROPPED.
- **v2.20.0** (migration 0046 phase 1): `trip_ideas` table retired; `tp-request mode` rip-out 啟動.
- **v2.19.x** (migration 0045): `pois.google_rating` → `rating`; `pois.maps` DROPPED; `trips.{auto_scroll,og_description,footer,food_prefs,is_default,self_drive}` DROPPED.
