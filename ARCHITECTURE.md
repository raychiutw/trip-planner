# Architecture

Tripline 的系統組成、資料流、信任邊界與部署拓撲。想改東西前先看這份，確保新增的 code 落在對的層次。

使用者介紹請看 [README.md](README.md)。設計系統與視覺規範請看 [DESIGN.md](DESIGN.md)。開發流程請看 [CLAUDE.md](CLAUDE.md)。

---

## Tech Stack

| 層 | 技術 |
|----|------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4（tokens.css @theme 為唯一 CSS 入口）|
| Routing | React Router v6（BrowserRouter，SPA 單入口）|
| Backend | Cloudflare Pages Functions（`functions/api/`，TypeScript，Workers runtime）|
| Database | Cloudflare D1（SQLite on the edge）|
| Auth | V2 OAuth — `tripline_session` opaque cookie (HMAC sig, HKDF derived sub-key) + Bearer token (client_credentials grant) for service tokens。Cloudflare Access 已 v2.32+ 全拆。詳 [src/server/session.ts](src/server/session.ts) + [functions/api/oauth/](functions/api/oauth/) |
| Build | Vite（SPA），Wrangler（Pages 本機模擬）|
| Testing | Vitest + @testing-library（unit / integration），Playwright（e2e），Miniflare（API integration）|
| Observability | Sentry（Vite plugin + runtime），NLog → D1 `api_logs` table |
| CI/CD | GitHub Actions + Cloudflare Pages auto-deploy |

---

## High-Level Topology

```
┌──────────────────────────────────────────────────────────────────┐
│                       使用者瀏覽器                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React SPA (src/entries/main.tsx, BrowserRouter)         │  │
│  │  5-tab IA: 聊天 / 行程 / 地圖 / 收藏 / 帳號 (mobile)     │  │
│  │  Desktop sidebar nav + 3-pane shell (≥1024px)            │  │
│  │  /trips list, /trip/:id (TripLayout), /chat, /map,       │  │
│  │  /favorites, /explore, /account, /auth/* OAuth flow ...  │  │
│  │  (/admin /manage redirect 已拆 2026-04-26 → /trips /chat)│  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS（Cloudflare edge）
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│       V2 OAuth (session cookie + Bearer token, v2.32+)            │
│  Cookie `tripline_session` (HMAC + HKDF) — 一般 user 登入後寫入   │
│  Header `Authorization: Bearer` — service token (client_credentials) │
│  `_middleware.ts` 對 mutating endpoint 驗 cookie + Origin (CSRF)  │
│  Cloudflare Access 已 v2.32+ 全拆，不再走 edge JWT gate           │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│              Cloudflare Pages（trip-planner-dby）                 │
│  ┌──────────────────────┐      ┌──────────────────────────────┐ │
│  │ Static assets (dist/) │      │ Pages Functions (functions/) │ │
│  │ index.html + JS/CSS   │      │ /api/* routes, TS            │ │
│  └──────────────────────┘      └─────────────┬────────────────┘ │
└────────────────────────────────────────────────┼─────────────────┘
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │ D1 (trip-planner-db)         │
                                  │ SQLite on the edge           │
                                  └──────────────────────────────┘
```

---

## Frontend

### 入口與路由

`src/entries/main.tsx` 單一 SPA 入口，5-tab IA + 多 sub-route。完整 route table
見 main.tsx，主要 group:

| Path group | 用途 |
|-----------|------|
| `/trips`, `/trip/:tripId/*` | 行程 list + TripLayout (含 collab / health / edit / add-* / stop edit) |
| `/chat`, `/map`, `/explore`, `/favorites` | global 5-tab pages (有 ActiveTripContext) |
| `/login`, `/signup`, `/login/forgot`, `/auth/*` | V2 OAuth 流程 (含 verify email landing v2.33.59) |
| `/account/*`, `/settings/*` | account hub + sessions / connected-apps / developer (alias) |
| `/admin`, `/manage` | 已 2026-04-26 拆，redirect to `/trips` / `/chat` |

BrowserRouter 走 pretty URL (無 hash)。`/manage/` 與 `/admin/` 的 `dist/` 仍有
`index.html` 複本以支援 direct access (build step in `package.json`)。

### 目錄結構

```
src/
├── entries/main.tsx         SPA 入口 + lazyWithRetry (v2.33.67 retry-budget reset)
├── pages/                   ~30 個 page (含 OAuth flow / settings / 動作頁 fullpage migrations)
├── components/
│   ├── trip/                Timeline / DayNav / DaySection / TripMapRail / DayMap ...
│   └── shared/              Icon / Toast / ErrorBoundary / PageNav ...
├── hooks/                   useTrip / useDarkMode / usePrintMode / usePermissions ...
├── lib/
│   ├── apiClient.ts         統一 fetch wrapper（處理 AppError）
│   ├── mapRow.ts            DB row → UI object 統一轉換
│   ├── scrollSpy.ts         純函式：捲動位置 → active day index
│   └── ...                  localStorage、sentry、weather、timelineUtils
└── types/                   trip.ts / api.ts
```

### 狀態管理

無 Redux / Zustand。狀態拆三層：

1. **Server state** — `useTrip`（SWR-style fetch + cache），`useRequests`（SSE）
2. **Cross-component UI state** — React context（`DarkModeProvider`、`PermissionsProvider`）
3. **Local state** — `useState` / `useRef`，不外流

### CSS 架構

`css/tokens.css` 是**唯一** CSS 檔，用 Tailwind CSS 4 的 `@theme` 定義 tokens（色彩、字體、圓角、間距、6 套主題）。元件一律用 utility classes；scoped styles 只用於 Tailwind 表達不了的 pseudo-element 或 dark mode 特例（見 `DayNav.tsx` 內的 `SCOPED_STYLES`）。

---

## Backend — Pages Functions

`functions/api/` 下的每個檔案對應一條 route。Cloudflare Pages 的約定：檔名與路徑結構決定 URL。

### 中介層（middleware chain）

`functions/api/_middleware.ts` 會在每個 request 進入前執行：

```
incoming request
  → detectSource()     從 header/cookie 判定 source（scheduler / companion / service_token / user / anonymous）
  → V2 OAuth verify    Bearer token (verifyJwt with alg pin) 或 session cookie (HMAC HKDF derived)
                       — 詳 src/server/session.ts + src/server/jwt.ts (v2.33.58 alg pin defense)
  → Origin check       CSRF defense (mutating route + cookie-only auth)，preview origin gated by ENVIRONMENT env
  → garbled text guard 驗 body 文字編碼（防亂碼）
  → AppError 攔截      所有 throw 統一包成 JSON 格式回應
```

**信任邊界重點**：`detectSource()` 的 source 是 **self-reported telemetry**，不是 auth decision。`X-Tripline-Source` / `X-Request-Scope` header 都可被偽造，消費端（如 daily-check）若要做 escalation 必須結合 path / error code 等 secondary signal，不能單憑 source gate。

### 錯誤處理

`functions/api/_errors.ts` 定義 `AppError` class 與錯誤碼表。Handler **一律** `throw new AppError('CODE')`，不直接 `return json({error}, status)` — 中介層會統一轉成 response，保證 response shape 一致。

### Route 分類

```
functions/api/
├── _middleware.ts       入口中介
├── _auth.ts             auth helpers（isAdmin, requireAuth）
├── _audit.ts            寫 audit_log
├── _errors.ts           AppError + errorResponse
├── _poi.ts              findOrCreatePoi + POI write helpers (v2.29.0 後 pois master only, trip_pois drop)
├── _entry_pois.ts       trip_entry_pois junction CRUD (v2.27.0 multi-POI per entry)
├── _session.ts / _cookies.ts  V2 OAuth session cookie helpers
├── _auth_audit.ts       auth_audit_log writer (HMAC IP hash via SESSION_IP_HASH_SECRET, v2.33.62)
├── _rate_limit.ts       per-IP rate limit (rate_limit_buckets table)
├── _maps_lock.ts        Google Maps Platform kill switch (app_settings)
├── _app_settings.ts     typed app_settings accessor (v2.33.62)
├── oauth/               OAuth 2.1 server endpoints (signup/login/forgot/reset/verify/authorize/consent/token/logout/well-known)
├── _types.ts            Env / shared types
├── _utils.ts            共用 DB / header helpers
├── _validate.ts         input validation + garbled guard
├── trips/               trips CRUD + batch days endpoint
├── pois/                POI CRUD（AI 維護的 master）
├── requests/            旅伴請求（含 SSE stream）
├── permissions/         trip_permissions CRUD
├── trips.ts             list trips（v2.19.0：POST 寫 destinations[] + auto-create 5 trip_docs stubs）
├── my-trips.ts          caller's accessible trips
├── requests.ts          top-level requests endpoint
├── reports.ts           error reports
├── poi-search.ts        Google Places Text Search proxy (v2.23.0，前端目的地 picker)
├── places/autocomplete.ts  Places Autocomplete (v2.31.94 custom POI add)
├── pois/[id]/enrich.ts  Google Place Details — 觸發 POI 補資料 + 更新 status
├── route.ts             Google Routes API proxy (driving / walking / transit)
└── trips/[id]/recompute-travel.ts  重排 entries 後 Google Routes 重算 (v2.30.0 後)
```

---

## Data Model

D1 schema 演進在 `migrations/0001 ~ 0045*.sql`（含 `migrations/rollback/` 反向 SQL）。核心表：

### 行程結構（時間軸）

```
trips (1)
  ├── trip_days (N)       每一天 (含 hotel_poi_id FK 自 v2.29.0)
  │     └── trip_entries (N)   每天的 timeline 條目 (entry_pois_version OCC counter)
  │           └── trip_entry_pois (N)  multi-POI junction (master sort_order=1 + alternates)
  └── trip_destinations (N)   多目的地子表（migration 0045 起，no osm_id; v2.23.0 切 Google Places）
```

### POI 模型 — `pois` master + `trip_entry_pois` junction (v2.27-v2.29 後)

```
pois               POI master (v2.23.0 Google Places enrichment — place_id 4 lifecycle col:
                   status active/closed/missing, status_reason, status_checked_at, last_refreshed_at)
trip_entry_pois    entry × poi junction (v2.27.0 migration 0057+0058)
                   sort_order=1 = 正選；sort_order>1 = 備選 alternates
                   metadata col: reservation / reservation_url / description / note
trip_days.hotel_poi_id  hotel 改 FK 而非舊 trip_pois context='hotel'
poi_relations      多對多 (例「景點附近餐廳」)
```

**已 DROP** (v2.29.x migration 0061-0063):
- `trip_pois` 整表 — 之前 COALESCE pattern (trip_pois overrides pois) 已過時
- `saved_pois` → 改名 `poi_favorites` (v2.22.0 migration 0050)

**POI 讀寫**: backend 用 `findOrCreatePoi(db, {...})` (functions/api/_poi.ts) +
`syncEntryMaster` / `addAlternate` / `setMaster` (functions/api/_entry_pois.ts)。

### Google Maps Platform stack (v2.23.0+)

OSM / Nominatim / Overpass / OpenTripMap / Wikidata / ORS / Haversine fallback 全 ripped out
(v2.23.0 hard cutover, no fallback)。改：

```
src/server/maps/google-client.ts   searchPlaces / autocompletePlaces / getPlaceDetails / computeRoute
                                   (requireApiKey pre-check, v2.33.58)
functions/api/poi-search.ts        Places Text Search proxy + pois_search_cache 24h TTL
functions/api/route.ts             Routes API proxy (driving / walking / transit, no fallback)
functions/api/pois/[id]/enrich.ts  即時 Place Details 補 POI metadata
functions/api/admin/maps-{lock,unlock,backfill-status,maps-settings,quota-estimate}.ts
                                   Kill switch + 90/50 hysteresis (app_settings table)
scripts/google-poi-refresh-30d.ts  daily refresh 50/day cap (mac mini cron)
scripts/google-poi-initial-backfill.ts
scripts/google-quota-monitor.ts

API endpoints:
  POST /api/pois/:id/enrich          手動觸發單一 POI enrich (admin/owner/即時 + 30d cron)
  POST /api/trips/:id/recompute-travel  重排 entries 後 Google Routes 重算 (v2.30.0+)
  GET  /api/poi-search?q=             Places Text Search proxy + pois_search_cache 24h TTL
  POST /api/places/autocomplete       Places Autocomplete (typeahead, v2.31.94)

排程 (mac mini cron via launchd):
  scripts/google-poi-refresh-30d.ts   每日 50/day cap (autoplan T11)
  scripts/google-poi-initial-backfill.ts  一次性
  scripts/google-quota-monitor.ts     monitor Google Cloud API quota
  (v2.31.4: poi-enrich-batch.ts + /tp-poi-enrich-monthly skill 已 rip out — 改 即時 + 30d 模型)
```

### 權限與審計

| 表 | 用途 |
|----|------|
| `trip_permissions` | 誰可以看哪個 trip（email 清單） |
| `trip_requests` | 旅伴請求（改行程 / 問建議） |
| `audit_log` | 所有寫操作的追蹤 |
| `api_logs` | 錯誤日誌（`source` 欄位做分類） |
| `trip_docs` | 行程附件（機票、訂房 PDF）|

### Trip Notes (v2.34.0+) — trip-level metadata 5 sections + AI generation

行程筆記（航班 / 住宿 / 預訂 / 行前須知 / 緊急聯絡）trip-level metadata 集中入 Tripline，user 不再切換 TripIt / Notion / Wanderlog。對齊 design doc `~/.gstack/projects/raychiutw-trip-planner/ray-master-design-20260528-144009.md`。

```
trip_flights              航班 (純手動，9 col + version OCC)
trip_lodgings             住宿 (純手動，可選 day_id ON DELETE SET NULL)
trip_reservations         預訂 (5-kind CHECK enum)
trip_pretrip_notes        行前須知 (AI 可生，ai_source 區分 lodging-tips / general-tips)
trip_emergency_contacts   緊急聯絡 (AI 可生，7-kind CHECK enum)
trip_note_ai_jobs         AI generation linkage (對齊 v2.33.102 CR-8 confused-deputy fix)
```

**AI generation 3 prompts**：
- `lodging-tips`（住宿在地建議）→ INSERT trip_pretrip_notes with ai_source='lodging-tips'
- `tips`（一般行前須知）→ INSERT trip_pretrip_notes with ai_source='general-tips'
- `emergency`（緊急聯絡）→ INSERT trip_emergency_contacts with kind narrowed

Trigger flow（CR-7 + CR-8 pattern）：
1. POST `/api/trips/:id/notes/:type/generate` → INSERT trip_requests + INSERT trip_note_ai_jobs linkage
2. Fire-and-forget trigger api-server（8s AbortController for CF Edge → Tailscale Funnel cold path）
3. Mac mini api-server tp-request skill 處理 message → PATCH /requests/:id with reply JSON
4. PATCH hook `applyNotesGenerationCompletion` 識別 linkage → 路由 doc_type → parse + dedup + INSERT rows + summary reply

**Frontend** `src/pages/TripNotesPage.tsx`（route `/trip/:tripId/notes`）：5 section accordion，mobile 預設展 航班，desktop ≥768px 全展開。`<FlightsSection>` / `<LodgingsSection>` / `<ReservationsSection>` / `<PretripSection>` / `<EmergencySection>` 每 section 獨立 component 處理 CRUD + autosave OCC + drag-reorder。

**Tests**（122+ tests）：
- migration 0073 17 + import HuiYun 9 + page shell 17 + section components 25 + integration 50 + E2E 4 + a11y 13 = 137 tests covering trip-notes

---

## Auth (v2.32+ V2 OAuth)

### 三種身份

1. **Anonymous** — 公開讀 `/trip/:tripId` (若 trip 已 published)
2. **User (V2 OAuth session)** — 自建 signup / login / forgot / reset / verify 流程，issue
   `tripline_session` opaque cookie (HMAC SHA-256 sig with HKDF-derived sub-key,
   v2.33.59 round 13)。session table `oauth_models` (D1) 維護裝置 list + revocation。
3. **Service Token** — Bearer token via OAuth client_credentials grant (RFC 6749 §4.4)，
   給 scheduler / admin tooling 用。`functions/api/oauth/token.ts` 走 atomic CAS consume
   防 parallel double-exchange (v2.33.58 round 12)

### Session verify (in-isolate CryptoKey cache, v2.33.63)

`functions/api/_middleware.ts` 走 `verifySessionToken(token, env.SESSION_SECRET)` —
dual-path (HKDF derived → legacy raw fallback for 30-day backward compat after
v2.33.59 round 13 cutover)。CryptoKey 在 isolate cache 避免每 request import。

### 本機 dev

用 `.dev.vars` 的 `DEV_MOCK_EMAIL` (注意 NOT `.env.local` — wrangler pages dev 只讀
`.dev.vars`)。Prod 安全靠 `_middleware.ts` `env.ENVIRONMENT === 'production'` 守衛拒絕
`DEV_MOCK_EMAIL` 生效 (wrangler.toml `[env.production.vars]` 強制聲明此 var)。

---

## Deployment

### 部署觸發

```
git push master
  ├─→ Cloudflare Pages webhook
  │     → npm run build（Vite SPA build）
  │     → 自動部署到 trip-planner-dby.pages.dev
  │     → pages-build-deployment workflow（GitHub Actions 做 status check）
  │
  └─→ .github/workflows/deploy.yml（只在 migrations/** 變更時觸發）
        → wrangler d1 migrations apply --remote
        → 10-30s 內完成（比 CF Pages build 60-120s 更早落地）
```

Migration 必須 **idempotent**（`IF NOT EXISTS` / `IF EXISTS`），因為 D1 不 wrap 多 statement 在跨 statement transaction；中途被 SIGKILL 會 half-applied，需要重跑安全。

### 環境

| 環境 | URL | DB binding |
|------|-----|-----------|
| Production | https://trip-planner-dby.pages.dev | `trip-planner-db` |
| Staging (preview branches) | `<branch>.trip-planner-dby.pages.dev` | `trip-planner-db-staging` |
| Local | http://localhost:5173 (vite) + http://localhost:8788 (wrangler) | 本機 SQLite |

---

## Observability

| 訊號 | 來源 | 儲存 |
|------|------|------|
| Frontend errors | Sentry SDK（`src/lib/sentry.ts`）| Sentry cloud |
| Backend errors | `AppError` throw → `_errors.ts` + `api_logs` INSERT | D1 `api_logs` table |
| Audit（寫操作）| `_audit.ts` | D1 `audit_log` table |
| Daily health | `scripts/daily-check.js` + Gmail API | Telegram（紅燈推播）|

---

## Testing

三層測試，`npm test` 默認跑前兩層，e2e 要手動：

```
tests/
├── unit/                  vitest + jsdom
│   ├── lib / hooks 的純邏輯
│   └── e.g. scroll-spy.test.ts, tokens-css.test.ts
├── api/                   vitest + miniflare（D1 in-memory）
│   ├── Pages Functions endpoint integration
│   └── 跑 `npm run test:api`
└── e2e/                   playwright
    ├── trip-page.spec.js, offline.spec.ts
    └── 跑 `npm run test:e2e`（需要本機 dev server）
```

**原則**：純函式 → unit；Pages Functions → api（用 miniflare 跑真 D1）；使用者流程 → e2e。

---

## Key Architectural Decisions

幾個「為什麼是這樣」：

1. **D1 on the edge, not PostgreSQL** — 行程是 read-heavy + 少量寫。D1 的 per-region replica + SQLite 讀取在 CF 的邊緣 node 跑，不需要另開 DB server。代價：跨 region 寫入延遲較高；在這個 workload 可接受。

2. **POI master + per-entry alternates（v2.29.0 起）** — `pois` 是 immutable master（Google Place Details refresh），`trip_entry_pois` junction（entry × poi M:N + `sort_order`）讓每個 entry 同時掛 1 主選 + N 備案。**過去**有 `trip_pois` 中間層做 trip-scoped override（COALESCE），實測 user 客製率低 + 維運成本高，v2.29.0 整表 rip-out 改純 reference。Trip-scoped 自由文字改寫進 `trip_entries.note`。

3. **V2 OAuth 自建（v2.21.x 起）而非 Cloudflare Access** — CF Access 強制綁 Google identity provider + 每 user $3/月，自架 OAuth server（opaque session cookie + HKDF + Bearer service token + client_credentials grant）打破 vendor lock-in 並降本到零。代價：自己管 session store、密碼 hash（PBKDF2 600k → Argon2id self-describing）、token rotation。Migration runbook 見 `docs/runbooks/oauth-env-setup.md`。

4. **Tailwind CSS 4 + @theme，不用 CSS modules** — 6 套主題（color theme × dark mode）的 token 切換用 CSS custom property 最簡。元件層全用 utility class，減少 dead CSS。

5. **無 state management library** — 服務狀態（trip / requests）用 custom hook + SWR-style fetch；UI 狀態用 React context 或 local state。Redux / Zustand 對這規模是 overkill。

6. **Google Maps Platform 全套切換（v2.23.0 起）** — OSM Nominatim + Mapbox + ORS + Leaflet + Haversine 全部 ripped out，no fallback。Search/Routes/Maps 統一 Google → 商業級資料品質 + license 一致 + Google `place_id` 變 canonical ID。代價：付費 + 配額管理。對應：`app_settings` 90/50 hysteresis kill switch + `/admin/maps-*` 8 endpoint + mac mini `google-quota-monitor` cron + `<TripHealthBanner>` 預警。Runbook 見 `docs/runbooks/v2.33-migration-deploy-order.md`。

7. **OCC（optimistic concurrency control）只放在多人編輯熱點** — `trip_entries.entry_pois_version` integer counter（v2.27.0）保護 master/alternates concurrent edit；`trip_days.version`（v2.30.x）保護整天 timeline save。兩者都用 atomic `WHERE version = ?` update，衝突 → 409 STALE_ENTRY，frontend refetch 後 retry。其他表暫不導入，避免 `IF version=X` 寫法蔓延。

---

## Schema / IA Naming History

過去 6 個版本的破壞性 rename / cutover（**hard cutover, no aliases**）。撞到 spec drift / 舊 sample code 時對照。

| Version | Migration | 變更 |
|---------|-----------|------|
| **v2.30.0** | 0064 | `trip_segments.mode_source` DROPPED — 移除「上鎖」概念。PATCH /segments/:sid contract 重寫：`mode='transit'` 必填 min（`source='manual'`，不打 Routes），`mode='driving'`/`'walking'` 一律 Google Routes 重算（ignore `body.min`, `source='google'`）。recompute-travel skip 條件 `mode_source='user'` → `mode='transit'`；response field `pairsSkippedUser` → `pairsSkippedTransit`。Frontend 移除 🔒 icon、isLocked 變數、「已手動覆寫」title indicator、EditEntryPage「重設為自動」button。 |
| **v2.29.x** | 0061-0063 | `trip_pois` 整表 rip-out（v2.29.0 / migration 0061+0062）：所有 alternates/master/hotel/shopping/restaurant 統一進 `trip_entry_pois` + `trip_days.hotel_poi_id` + `poi_relations`。`DROP TABLE saved_pois`（v2.29.1 / migration 0063，poi-favorites-rename Phase 2 — 10 天 soak 後）。Stale-travel ⚠ 偵測改用 `segment.computed_at IS NULL` signal（v2.29.2，拔 Haversine vs distance divergence 邏輯）；daily-check `queryRequestErrors` 移除 stale SELECT `trip_requests.mode`（v2.29.3）。 |
| **v2.22.0** | 0050 | `saved_pois` table → `poi_favorites`；route `/saved` → `/favorites`；API `/api/saved-pois` → `/api/poi-favorites`；`SavedPoisPage` → `PoiFavoritesPage`；`AddSavedPoiToTripPage` → `AddPoiFavoriteToTripPage`；CSS class `tp-saved-*` → `tp-favorites-*`。AddPoiFavoriteToTripPage 改 4-field 純時間驅動（廢 position + anchorEntryId）。Cross-skill auth header `CF-Access-*` → `Authorization: Bearer $TRIPLINE_API_TOKEN`。companion gate（middleware + `_companion.ts` requireFavoriteActor）+ `companion_request_actions` UNIQUE table 防 quota abuse + audit_log `companion_failure_reason` field。 |
| **v2.21.3** | 0049 | `trip_requests.mode` column DROPPED（phase 2，標準 swap idiom）。tp-request skill 改 auto-classify intent，不再 dispatch by mode field。 |
| **v2.21.2** | 0048 | `trip_requests.mode` 改 nullable + drop CHECK constraint（phase 1 of mode rip-out）。 |
| **v2.21.0** | 0046+0047 | `trip_ideas` table 退場 → `saved_pois` 升 universal pool（跨 trip 願望清單）；`trips.owner_email` → `owner_user_id` cutover（V2 OAuth 對齊）；`saved_pois.email` / `trip_permissions.email` DROPPED；UNIQUE constraint 改 `(user_id, ...)`。0047 採 backup-restore pattern（trips/pois 有 children FK）。 |
| **v2.20.0** | 0046 phase 1 | `trip_ideas` table 退場 phase 1；tp-request mode rip-out 啟動。 |
| **v2.19.x** | 0045 | `pois.google_rating` → `rating`；`pois.maps` DROPPED；`trips.{auto_scroll,og_description,footer,food_prefs,is_default,self_drive}` DROPPED。 |

**找舊欄名 / 舊 route 規則**：grep 整個 codebase 後 fail → 對照表確認是否已 rename → 改用新名 → 不要寫 alias。新功能 reference `openspec/specs/` 而非 `openspec/changes/archive/`（archive spec 有 banner 標明 superseded）。

---

## Related Docs

- [README.md](README.md) — 使用者介紹、功能特色
- [CLAUDE.md](CLAUDE.md) — 開發流程、gstack pipeline
- [DESIGN.md](DESIGN.md) — 設計系統、視覺 tokens
- [CHANGELOG.md](CHANGELOG.md) — 版本紀錄
