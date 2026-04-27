# 2026-04-25 Session Retro — B workstream 收尾 + V2 OAuth 選型

**Date:** 2026-04-25
**Branch ship count:** 10（#225 ~ #234）
**Workstream:** B（Layout / Nav / Sheet / Explore / Wrap-up）
**Decision doc:** `docs/v2-oauth-server-plan.md`

---

## TL;DR

1. **B workstream P1-P4 上線**（schema + AppShell + DesktopSidebar + BottomNavBar + 4 routes + URL-driven sheet + Explore MVP + POI Search API）
2. **B-P5 drag-to-itinerary 延後 V2**（需先做 Ideas UI 再做 drag）
3. **B-P6 wrap-up 完成**（roadmap 更新 + scope 收尾）
4. **V2 OAuth 決定**：Panva `oidc-provider` + 自寫 D1 adapter + CF Pages Functions（`docs/v2-oauth-server-plan.md`），fallback 為 `@openauthjs/openauth` + KV
5. **本機 QA Health 85/100**（0 critical bug，2 個 environmental notes）
6. **修一顆 `init-local-db.js` table 順序 bug**（pois 必須在 trip_entries 前；本 PR 附 TDD test）

---

## Shipped PRs（#225 ~ #234）

| # | Title | Phase |
|---|-------|-------|
| #225 | docs(design-sessions): 11 mockup HTML + roadmap update + agent-skills cleanup | mockup + plan |
| #226 | feat(layout-p2): §2 AppShell layout primitive + tests | B-P2 §2 |
| #227 | feat(layout-p2): §3 DesktopSidebar 5 nav + user chip + new trip CTA | B-P2 §3 |
| #228 | feat(layout-p2): §4 BottomNavBar sticky + rename from MobileBottomNav | B-P2 §4 |
| #229 | feat(layout-p2): §5+§6 Pages refactor 套 AppShell + 4 placeholder pages | B-P2 §5-6 |
| #230 | refactor(layout-p2): /simplify findings — Placeholder DRY + TripPage cleanup | B-P2 cleanup |
| #231 | feat(layout-p3): URL-driven sheet state — ?sheet=itinerary\|ideas\|map\|chat | B-P3 |
| #232 | feat(layout-p4): Explore page MVP — Nominatim search + saved pool | B-P4 |
| #233 | docs(layout-p5-p6): B workstream wrap-up — roadmap 更新 + scope 收尾 | B-P5/6 |
| #234 | docs(v2-oauth): 選擇 Panva oidc-provider + D1 adapter + CF Pages Functions | V2 plan |

---

## B Workstream 最終狀態

| Phase | Scope | Status |
|-------|-------|--------|
| B-P1 | Schema：saved_pois / trip_ideas / order_in_day | ✅ shipped (#4052316) |
| B-P2 | Layout shell：AppShell + DesktopSidebar + BottomNavBar + 4 routes + Placeholder DRY | ✅ shipped (#226-230) |
| B-P3 | URL-driven sheet state：`?sheet=itinerary\|ideas\|map\|chat` + `/trip/:id/map` 301 redirect | ✅ shipped (#231) |
| B-P4 | Explore MVP：POI search + saved pool + find-or-create | ✅ shipped (#232) |
| B-P5 | Ideas drag-to-itinerary | ⏸ 延後 V2（需先做 Ideas UI placeholder→real） |
| B-P6 | Wrap-up：Playwright E2E + /design-review（staging） | ✅ docs-only (#233)；E2E + design-review 留 V2 |

---

## V2 OAuth Server 選型決定（詳見 `docs/v2-oauth-server-plan.md`）

### 決策

**Panva `oidc-provider` + 自寫 D1 adapter + CF Pages Functions**

### 為何不是其他選項

| Option | 排除原因 |
|--------|---------|
| `@openauthjs/openauth` | 官方 adapter 只支援 KV，不支援 D1（破壞 D1-only convention） |
| Authelia / Rauthy / Ory Hydra | 跨語言 OAuth server（Go / Rust / etc.）— Cloudflare Workers V8 isolates 只支援 JS/TS，不能跑 |
| Cloudflare Containers | 2024 beta / waitlist，未普及 |
| WASM OAuth servers | 既有 Rust servers 無 WASM build |
| 自寫 TS from scratch | 16+ 週，security 風險高 |

### Fallback

若 Day 0 spike 發現 `oidc-provider` 在 `nodejs_compat` 下不能 instantiate `koa`，fallback 到 `@openauthjs/openauth` + KV（接受 KV binding 破例）。

### Phased implementation（spike 過後）

V2-P1（Identity core）→ V2-P2（Local password）→ V2-P3（忘記密碼）→ V2-P4（OAuth Server 基本）→ V2-P5（Token + Consent）→ V2-P6（Security hardening）→ V2-P7（Docs + audit + launch）= 14 週

---

## 本機 QA（2026-04-25）

**Report:** `.gstack/qa-reports/qa-report-localhost-2026-04-25.md`
**Health:** 85 / 100
**Critical bugs:** 0
**Medium bugs:** 0

### 通過

- 5 sidebar nav routes（/manage /chat /map /explore /login）全 200 + 0 console errors
- TripSheet URL-driven tab 切換（itinerary / ideas / map / chat）全過
- `/trip/:id/map` 301 redirect to `?sheet=map#day1` 正確觸發
- POI Search API Nominatim 中文 query 回傳「冲绳县 / 沖繩縣」（驗證中文查詢有效）
- AppShell data-testid（`app-shell` / `app-shell-sidebar` / `desktop-sidebar`）正確掛載

### Environmental notes（非 code bug）

1. `/manage` 無 `.dev.vars` 的 `DEV_MOCK_EMAIL` 時會 auto-redirect 到 default trip（既有行為）
2. Default trip `okinawa-trip-2026-Ray` 顯示「載入中...」（本機 D1 沒 seed）→ 已於本 session 尾端解決（倒入 prod data）

### 本機 prod data 已倒入（2026-04-25 尾端）

- `backups/2026-04-24T22-52-51/` 包含 10 tables dump
- trips: 2（okinawa-trip-2026-Ray + -HuiYun）
- trip_days: 12
- trip_entries: 91
- trip_pois: 149
- pois: 182

> ⚠️ 倒入過程遇到 `init-local-db.js` table 順序 bug（trip_entries / trip_pois import 0 rows）→ 手動修復 + 本 PR 加 TDD test + 修正 source。

---

## 本 PR 修的 bug：`init-local-db.js` table 順序

### Bug

`scripts/init-local-db.js:21` 的 `TABLES` 陣列排 `trip_entries` 在 `pois` 之前：

```js
const TABLES = ['trips', 'trip_days', 'trip_entries', 'pois', ...]
```

但從 migration `0026_trip_entries_poi_id.sql` 起，`trip_entries.poi_id` FK 指向 `pois.id`。FK-enforced import 會讓 `trip_entries`（和之後的 `trip_pois`）skip 所有 row，跑出來的本機 DB 只有 `trips / trip_days / pois` 有資料，其他全 0。

### Fix

`TABLES` 改成 FK-safe 順序：

```js
const TABLES = ['trips', 'trip_days', 'pois', 'trip_entries', 'trip_pois', ...]
```

### Regression test

`tests/unit/init-local-db-table-order.test.ts`（10 cases，regex 從 source extract TABLES，對照 FK 依賴圖驗證順序）。

---

## Pending work

### 本 session 未處理

- **sheet map tab 高度問題** — TripMapRail 在 `?sheet=map` 下只填滿 sheet 上 1/4；需要檢視 sheet container flex layout
- **`/manage` auto-redirect 調查** — 既有行為（非 session 引入），但不清楚觸發點；使用者本機設 `.dev.vars` 後應該就正常
- **第三輪 QA** — prod data 已倒入，適合重跑 QA 看完整 TripPage 3-pane

### 前 session 留的 Day-0 assignments（2026-04-24）

- ✗ 查 Cloudflare Access deny log 裡非 Ray / HuiYun 的 distinct email（demand 驗證）
- ✗ 第三方 dev 15 分鐘 interview（demand 驗證）

### V2 Roadmap 下一步

- V2 Day 0 spike — 驗證 `oidc-provider` + `nodejs_compat` 能啟動（本 session 會做，獨立 PR）
- V2-P1 → V2-P7（14 週）— spike 通過後排程
- External security audit 預約（Trail of Bits / Cure53，lead time 4-8 週，V2-P1 起要 book）

---

## 檔案變動摘要

### 本 PR（chore/2026-04-25-retro-plus-init-fix）

- 新：`docs/2026-04-25-session-retro.md`（本文）
- 新：`tests/unit/init-local-db-table-order.test.ts`（10 test cases）
- 改：`scripts/init-local-db.js`（TABLES 順序 + 加註記指向 test 檔）
- 更新 memory：V2 OAuth 決定 / init-local-db bug / prod→local import 步驟

### 本 session 累計（master 新增）

- 11 mockup HTML（`docs/design-sessions/`）
- AppShell + DesktopSidebar + BottomNavBar + Placeholder + TripSheet 5 個 shell component
- TripSheetTabs / trip-url helpers
- 4 新 placeholder pages（Chat / GlobalMap / Explore / Login）
- Explore MVP 實作 + POI Search API + find-or-create API
- Tokens 擴充（grid-3pane/2pane/nav-height/hover-brightness）
- 20+ 新 test cases（AppShell / DesktopSidebar / trip-url / TripSheet / ExplorePage / placeholders / tokens-bottom-nav-sticky）
- V2 OAuth plan doc（285 行）
