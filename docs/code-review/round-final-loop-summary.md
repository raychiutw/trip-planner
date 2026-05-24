# Loop review final summary — Rounds 1-27 (v2.33.77)

**Date**: 2026-05-24
**Trigger**: `/loop Loop review 全部程式碼 全部修正`
**Scope**: 全 repo (src/ + functions/ + scripts/ + tests/ + docs/) deep review with mandatory low-priority + deferred follow-through

## Summary

27 rounds 完整 sweep。從 Round 1（lib/ security）到 Round 27（dead test cleanup），shipped 27 PR （PR #644 ~ PR #765）。

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Test count | 2,328 | 2,640+ | +312 |
| Test duration | 21s | 16s | -24% |
| npm audit HIGH CVE | 3 | 0 | -3 |
| docs drift items (ARCHITECTURE) | 5 critical | 0 | -5 |
| Stale dead test | 1+ | 0 | -1 |
| Runbook docs | 0 | 2 | +2 |
| Mock factories | 0 | 6 | +6 |
| Untested pages | 12 | 0 | -12 |

## Phase breakdown

### Phase 1: Foundation security (Round 1-9)

- `src/lib/` security pass — sanitize, escape, URL allow-list
- Hooks review — `useRequireAuth` + `useCurrentUser` refresh patterns
- `functions/api/` 5 sub-pass — anon read, anti-enum, CSRF/Bearer/atomic, residuals
- Components security (XSS / dangerous render)
- Style/token drift sweep
- Pages security (XSS in markdown, link sanitize)
- Scripts security (cron / cred handling)
- Lib test catch-up

### Phase 2: Architecture (Round 10-14)

- Lib reverse-import audit (Round 10)
- OceanMap split — Leaflet → Google Maps JS API (Round 11)
- Server security audit (Round 12-13)
- Infrastructure review (Round 14) — GitHub Actions / CI / Dependabot

### Phase 3: Deferred deep-dive (Round 15-23)

- Round 15 — comprehensive finding inventory，identified architectural deferred
- Round 16-17 — npm audit cleanup, dependency upgrade
- Round 18 — ARCHITECTURE doc drift (CF Access → V2 OAuth, OSM → Google)
- Round 19 — runbooks (oauth-env-setup, v2.33-migration-deploy-order)
- Round 20 — mock factories (6 canonical shapes, defend v2.31.14/15/27 family)
- Round 21 — vitest workspace split (24% speedup)
- Round 22-23 — untested page smoke tests (12 pages)

### Phase 4: Final cleanup (Round 24-27)

- Round 24 — 8 admin endpoint security guard (source-grep, EADDRNOTAVAIL-resistant)
- Round 25 — E2E api-mocks schema parity (savedAt → favoritedAt + email drop)
- Round 26 — ARCHITECTURE Key Architectural Decisions rewrite (ADR #2/3 + 6/7 NEW)
- Round 27 — dead migration-0033 test deletion

## Lessons

### What worked

1. **Mock factories as drift defense** — v2.31.14/15/27 family taught us snake_case
   test mocks silently mask camelCase backend response bugs. Factories enforce shape.
2. **Source-grep > integration for stability** — Miniflare port exhaustion in 71-file
   parallel runs (EADDRNOTAVAIL) made integration tests unreliable. Source-grep
   in 100ms catches regression patterns reliably.
3. **Workspace split = real perf win** — 199/210 .test.ts don't need jsdom；
   moving to node env shaved 5s off every CI run.
4. **Branch per round, auto-merge** — small atomic PR per round (1-3 file change)
   made review cheap. 27 PR shipped in 24h.

### What didn't

1. **整 integration test 重建 too ambitious** — Round 15 initially tried writing
   integration test for 25 untested endpoints. Port exhaustion killed it. Pivoted
   to source-grep for 6 admin endpoints, deferred rest to local dev verification.
2. **Branch hygiene incident** — Round 15a once committed directly to master.
   Recovered with `git reset --hard origin/master` and forked proper branch.
3. **DESIGN-mockup pipeline overhead** — initial impulse to write mockup for
   internal refactors got pushed back ("無關 UI 的不用 mockup"). Saved to memory.

### Process improvements ratified

- testid rename: must grep across unit + e2e + src (not just `tests/unit/`)
- git mv ordering: do `git mv` BEFORE Edit (otherwise edit lost)
- spec backward-compat claim: must verify against ALLOWED_FIELDS source first
- /review polish: prefer "全部修" same-PR over defer-to-follow-up

## Open items (intentionally not done)

- **19 integration tests** for remaining API endpoints — system constraint
  (Miniflare port exhaustion), needs reworked test infra
- **GitHub Settings UI** — Split CLOUDFLARE_API_TOKEN, Environment protection,
  disable "Allow GH Actions create PR" — needs human owner action
- **5 moderate CVE** — upstream packages, no fix released yet
- **CSP `unsafe-inline`** — Tailwind 4 inline `<style>` requires it
- **Telegram bot token in URL** — protocol limitation, no fix
- **Migration 0011/0013** — historical, never deployed beyond initial seed
- **CSP report-uri PLACEHOLDER** — needs Sentry endpoint URL (user task)

## Coverage end-state

- All 8 `functions/api/admin/*.ts` have guard test
- All 12 previously-untested pages have smoke test
- All foundational lib/ utilities have unit test
- Mock factories cover 6 most-used backend response shapes
- E2E api-mocks aligned with backend deepCamel response

## Next loop seed

Future review trigger could focus on:
- Performance: Core Web Vitals baseline measurement via `/benchmark`
- A11y: Automated WCAG check on key pages
- Bundle size: tree-shake audit, lazy-load split
- E2E coverage: which user journeys lack happy-path E2E

End of 27-round loop. Master is clean at v2.33.77.
