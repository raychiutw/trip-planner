# Round 14 — frontend infra + migrations review (v2.33.60)

**日期**: 2026-05-24
**PR**: TBD (refactor/v2.33.60-round-14-infra → master)
**Module**: `public/_headers`, `public/_routes.json`, `public/manifest.json`,
`wrangler.toml`, `vite.config.ts`, `tsconfig.functions.json`, `css/tokens.css`,
`scripts/auth-cleanup.js`, `index.html`, 2 個新 migration

## 背景

backlog #133 — 2 個 parallel agent (code-reviewer / security-auditor) review
frontend infra + 70 個 migration。發現 0 CRITICAL / 11 HIGH / 13 MEDIUM /
10 LOW finding。本 PR 處理可獨立完成的 10 個 fix。

## 修了什麼 (10 個 fix)

### 1. _headers CSP narrow + global security headers (HIGH)

**Before**:
- `connect-src` 含 `*.googleapis.com` (太寬，BigQuery / Firebase / AppsScript 都通)
- `img-src 'self' https: data:` wildcard (任意 https image — XSS 後 exfil sink)
- 缺 `frame-ancestors` (modern browser 優先用此而非 XFO)
- 缺 `object-src 'none'`、`upgrade-insecure-requests`
- 缺 global `X-Content-Type-Options: nosniff` (僅 /og/* 有)
- 缺 `Referrer-Policy`
- 缺 `Cross-Origin-Opener-Policy: same-origin`

**After**:
- `connect-src` 縮為精確 3 個 Google 子網域: `maps.googleapis.com` /
  `places.googleapis.com` / `routes.googleapis.com`
- `img-src` 縮為 `self` + `data:` + Google CDN 4 個來源
- 加 `frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests`
- 加 global `nosniff` + `Referrer-Policy: strict-origin-when-cross-origin` + COOP

### 2. index.html theme-color 對齊 manifest (HIGH)

之前 `#0077B6` (v2.23.0 前 ocean blue 殘留) vs manifest `#F47B5E` terracotta
→ Android URL bar + PWA splash 顏色錯。改 `#F47B5E`。

### 3. vite.config 拔 leaflet + 補 manualChunks (HIGH+MED)

- 拔 `optimizeDeps: { include: ['leaflet'] }` (v2.23.0 後 leaflet 已 rip out)
- manualChunks 補 5 個 heavy deps: `gmaps` (Google Maps JS) / `headlessui` /
  `dndkit` / `datepicker` / `marked` / `pdf`。lazy-load route 不再拖整 sibling

### 4. _routes.json `/og/*` exclude (HIGH)

`_headers` 已對 `/og/*` 設 cache rule 但 `_routes.json` 不 exclude → Open Graph
image 仍經 CF Function (cold-start tax)。加 exclude。

### 5. manifest scope/id/lang/description + icon purpose (HIGH)

之前缺 `scope` / `id` / `lang` / `description` + icon 無 `purpose`。Without
`scope`/`id`，preview deploy URL 可能被當成同 PWA 蓋掉 user 安裝。補齊。
(maskable icon 需新 asset design，留 follow-up)

### 6. wrangler.toml [env.production.vars] (MED)

`_middleware.ts:241-247` `DEV_MOCK_EMAIL` 守衛靠 `envBag.ENVIRONMENT === 'production'`
判拒。若 CF dashboard 沒設 → guard fail-open → prod auth bypass 風險。改在
`wrangler.toml` 強制聲明 `[env.production.vars] ENVIRONMENT = "production"`。

### 7. tsconfig.functions exclude (MED)

`"exclude": []` 空 array 蓋掉 base config 的 `node_modules`/`dist`，slow typecheck
+ 可能拉 browser-only types 進 Workers context。改 `["node_modules", "dist"]`。

### 8. tokens.css warning hue + toast border color-mix (MED)

- dark mode `--color-warning` 從 yellow `#F0D060` 改 orange `#FAA94B` 維持 hue
  一致 (之前 light orange / dark yellow 跨 hue brand 不一致)
- toast border 寫死 `rgba(193,53,21,...)` → `color-mix(in srgb, var(--color-destructive)
  32%, transparent)`，dark mode 跟 token 變色

### 9. auth-cleanup.js 4 個新 retention sweep (MED)

新增：
- `trip_invitations` (accepted 90d / expired 30d) — PII (email + trip pair) 不
  該無限保留
- `pois_search_cache` (expires_at < now) — 之前 TTL signal 無人 sweep
- `companion_request_actions` (90d) — append-only audit row
- `error_reports` (90d) — 含 user_agent fingerprint + 攻擊者可控 context

### 10. 2 個新 migration (HIGH)

- **0069**: `trip_health_reports.user_id` + `request_id` 補 FK (`ON DELETE CASCADE`
  + `ON DELETE SET NULL`)。D1 swap pattern with INNER JOIN users guard。
- **0070**: 修補 0047 漏 `sqlite_sequence` preserve — AUTOINCREMENT 5 個 table
  (`trip_days`/`trip_entries`/`trip_destinations`/`trip_docs`/`trip_doc_entries`)
  ID collision risk fix。idempotent，多次跑安全。

### Bonus: orphan .ocean-rail-line DOM removal

`TimelineRail.tsx` line 995 `<div className="ocean-rail-line">` 對應 CSS
`display: none` 已久，DOM 留著無意義。拔。

## Tests

`tests/unit/round-14-infra.test.ts` — 24 個 source-grep guard
全 suite 2504 → 2528 (+24)，tsc clean。

## Deferred (個別 PR)

| Finding | Why |
|---------|-----|
| 3 個 npm audit CVE (babel/serialize-javascript/fast-uri) | `npm audit fix` 風險評估 — pin via overrides，獨立 PR |
| `audit_log` FK + user_id 補 | 無 user delete 功能，低優先 |
| `_auth_audit_log.ip_hash` HMAC | 需 SESSION_IP_HASH_SECRET infra |
| SW cache `/api/trips/*` cross-user PII | 需小心 cacheKey 設計 |
| Preview-deploy origin policy split | 架構決策 |
| CSP `style-src 'unsafe-inline'` 拔 | Tailwind 4 + Vite forced — 等 Vite 9 / Tailwind 5 nonce inject |
| Migration 0011 SELECT silent output | 歷史 migration 不能改 — 留 comment 標 |
| Migration 0013 okinawa slug leak | 已 apply 不能 undo |
| `email='*'` wildcard 已 silent drop | 已被 `trips.published=1` 取代 |

## Status

- ✅ 10 個 HIGH+MED fix
- ✅ tsc clean
- ✅ 2528 / 2528 全綠 (+24)
- ✅ #133 closes
