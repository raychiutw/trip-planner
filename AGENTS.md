# Tripline

Cloudflare Pages + D1 + React SPA + V2 OAuth. Admin: lean.lean@gmail.com.

## Development workflow (Matt Pocock official chain)

`/grill-with-docs → /to-spec → /to-tickets → /implement → /code-review`

Follow the applicable steps in this order. Do not implement while shared
understanding, a test seam, or a ticket breakdown is still awaiting user
approval. `/to-spec` and `/to-tickets` are durable multi-session handoff steps;
a small, settled, single-session change may proceed directly to `/implement`.

1. **Clarify — `/grill-with-docs`**: for ambiguous work, ask one question at a
   time, answer repository facts by inspecting the code, and do not implement
   until the user confirms shared understanding. Update `CONTEXT.md` only for
   settled domain vocabulary; create an ADR only for a hard-to-reverse,
   surprising decision with a real trade-off.
2. **Specify — `/to-spec`**: for work that needs a durable spec, propose the fewest existing,
   highest-level test seams and get user approval. Then synthesize the agreed
   conversation without reopening requirements and publish the PRD to GitHub
   Issues with `ready-for-agent`.
3. **Slice — `/to-tickets`**: use only when multiple context-sized tracer-bullet
   slices are useful. Each ticket must be end-to-end and independently
   verifiable, declare real blockers, and use `ready-for-agent`. Present the
   breakdown and obtain user approval before creating any ticket. Publish
   blockers first and work only the unblocked frontier, one ticket per fresh
   context. Do not manufacture tickets for work that fits one implementation
   session.
4. **Build — `/implement`**: start only from an approved spec or ticket and on a
   feature branch. Use the pre-agreed seams; `/implement` drives `/tdd`
   internally, one red-green behaviour at a time, with targeted tests and
   typechecks during the loop and the full suite at the end.
5. **Review — `/code-review`**: review from a pinned fixed point with Standards
   and Spec findings kept separate, then resolve every accepted finding.

After the official chain, apply Tripline's repository-local release policy:
verify user-facing behaviour, then publish a GitHub PR from a feature branch
with normal `git` / `gh`. The feature-branch, PR, and mockup gates below are
Tripline rules, not upstream Matt Pocock chain steps.

Standalone routing remains available when the full chain is unnecessary:
bugs use `/diagnosing-bugs`; architecture/interface questions use
`/codebase-design`; a concrete, already-settled
single behaviour may use `/tdd` directly.

Official upstream references:
[workflow](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/grill-with-docs.md#L42-L50),
[`to-spec`](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/to-spec.md#L13-L37),
[`to-tickets`](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/to-tickets.md#L13-L42),
[`implement`](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/implement.md#L13-L29), and
[`code-review`](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/code-review.md#L13-L31).
Detailed comparison: [`docs/research/2026-08-03-matt-pocock-skills-workflow.md`](docs/research/2026-08-03-matt-pocock-skills-workflow.md).

When multiple skill frameworks could apply and the user has not named one, use this priority:

1. Matt Pocock engineering skills in `~/.agents/skills/`
2. OpenSpec
3. Superpowers
4. gstack

Do not stack duplicate workflows. Use a lower-priority framework only when the
Matt Pocock skills do not cover the task or the user explicitly requests it.
`/tp-team` is no longer a required or supported entry gate.

## Hard Rules (sync with CLAUDE.md)

- **Code change → follow the Matt Pocock workflow above first. Do not invoke `/tp-team`.** 行程資料用 `tp-*` data skills 直接打 API。
- Read `CLAUDE.md` for project facts, naming history, and non-conflicting hard
  rules. If its legacy agent pipeline conflicts with the official Matt Pocock
  chain above, this `AGENTS.md` workflow controls.
- **Mockup-first hard gate**：所有 new page / new component（≥1 layout 變化）→ `/prototype` 的 UI branch 產生可比較 prototype → user sign-off → 才寫 React。Bug fix / token drift / 純 prop tweak / 內部 refactor (無 UX 變化) 例外。
- Feature branch + GitHub PR. Never push master directly.
- `tp-*` skills hit API, not local files.
- Agent tool only for worktree isolation.
- Web browse: `/browse` only, never `mcp__claude-in-chrome__*`.

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

Match → invoke the Matt Pocock `Skill` first.

- Requirements / decisions + docs → `/grill-with-docs`
- Existing discussion needing a durable handoff → `/to-spec`
- Multi-session, multi-slice delivery plan → `/to-tickets`
- Bug / regression → `/diagnosing-bugs`
- Approved spec / ticket, or settled single-session change → `/implement`（internally drives `/tdd`）
- Concrete single behaviour without a full spec → `/tdd`
- Module architecture / interface alternatives → `/codebase-design`
- Throwaway UI or logic validation → `/prototype`
- Code review → `/code-review`
- User-facing verification / durable issue filing → repository tests or browser + normal `gh`

OpenSpec, Superpowers, and gstack are fallback frameworks in that order; they
must not replace or duplicate an applicable Matt Pocock workflow unless the
user explicitly asks.

Detail: `ARCHITECTURE.md`, `GEMINI.md`, `DESIGN.md`, `docs/agents/`.
Prod: https://trip-planner-dby.pages.dev/ · GBrain: pglite, see `~/.gbrain/config.json`.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default mattpocock/skills triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Use the single-context domain docs layout. See `docs/agents/domain.md`.
