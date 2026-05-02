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
| Auth | V2 OAuth self-built（`tripline_session` HMAC opaque cookie + `/api/oauth/*`）。CLI / service tokens 走 `client_credentials` grant。Cloudflare Access **已 V2-P6 完全拆除**。 |
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
│  │  React SPA (main.tsx, BrowserRouter)                     │  │
│  │  ├─ /trips                → TripsListPage (landing)     │  │
│  │  ├─ /trips?selected=:id   → TripPage (embedded)         │  │
│  │  ├─ /trip/:id/map         → MapPage (fullscreen)        │  │
│  │  ├─ /chat / /map / /explore / /account                  │  │
│  │  ├─ /login / /signup / /auth/password/reset             │  │
│  │  └─ /developer/apps / /settings/connected-apps          │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS（Cloudflare edge）
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│              Cloudflare Pages（trip-planner-dby）                 │
│  ┌──────────────────────┐      ┌──────────────────────────────┐ │
│  │ Static assets (dist/) │      │ Pages Functions (functions/) │ │
│  │ index.html + JS/CSS   │      │ /api/* routes, TS            │ │
│  │ + V2 Auth pages       │      │ + /api/oauth/* V2 OAuth      │ │
│  └──────────────────────┘      └─────────────┬────────────────┘ │
│                                                │                  │
│  Auth: tripline_session opaque HMAC cookie     │                  │
│  middleware → getSessionUser(cookie) +         │                  │
│  Bearer token (client_credentials) for CLI     │                  │
└────────────────────────────────────────────────┼─────────────────┘
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │ D1 (trip-planner-db)         │
                                  │ SQLite on the edge           │
                                  │ + users / sessions / oauth   │
                                  └──────────────────────────────┘
```

---

## Frontend

### 入口與路由

`src/entries/main.tsx` 單一 SPA 入口（BrowserRouter pretty URL）。Trip detail 設計為 `TripsListPage` 包 `TripPage` embedded：landing 顯示 trip cards，點選後 `?selected=:id` 內嵌 detail，桌機 3-pane sidebar + main 結構由 `AppShell` 統一。`/trip/:tripId` 為相容 redirect → `/trips?selected=:id`。

| Path | Component | 用途 |
|------|-----------|------|
| `/trips` | `TripsListPage` | landing：trip cards grid + embedded TripPage when `?selected=` |
| `/trips?selected=:id` | embeds `TripPage` | trip detail（timeline + day nav + sheets） |
| `/trip/:id` | redirect → `/trips?selected=:id` | 相容舊分享連結 |
| `/trip/:id/map` | `MapPage` | fullscreen 地圖（總覽 + 每日 day tabs） |
| `/trip/:id/collab` | `CollabPage` | 共編設定（v2.18.0 升格獨立頁） |
| `/chat` | `ChatPage` | 旅伴請求 + AI 對話 |
| `/map` | `GlobalMapPage` | 全域地圖（所有 trips） |
| `/explore` | `ExplorePage` | POI 探索 + 收藏 |
| `/account` 等 | `AccountPage` / `AppearanceSettingsPage` / `NotificationsSettingsPage` | 帳號設定 |
| `/login` / `/signup` / `/auth/password/reset` | V2 Auth pages | self-built OAuth flow |
| `/developer/apps` / `/settings/connected-apps` / `/settings/sessions` | OAuth client + session 管理 | Developer dashboard 與 user-facing OAuth 控制 |

`/manage` / `/admin` 已移除（v2.17.17）— 改 redirect 到 `/chat` / `/trips`。

### 目錄結構

```
src/
├── entries/main.tsx         SPA 入口（BrowserRouter）
├── pages/
│   ├── TripsListPage.tsx    /trips landing + embedded TripPage host
│   ├── TripPage.tsx         行程 detail（embedded by TripsListPage when ?selected=）
│   ├── MapPage.tsx          /trip/:id/map fullscreen
│   ├── GlobalMapPage.tsx    /map 全域地圖
│   ├── ChatPage / ExplorePage / AccountPage 等
│   └── auth/                LoginPage / SignupPage / EmailVerifyPendingPage
│                             / ForgotPasswordPage / ResetPasswordPage / ConsentPage
│                             / ConnectedAppsPage / DeveloperAppsPage / SessionsPage
├── components/
│   ├── trip/                Timeline / DayNav / DaySection / TripMapRail / Restaurant
│   │                          / EntryActionPopover / AddStopModal / MapFabs ...
│   ├── shared/              Icon / Toast / ConfirmModal / InputModal / ErrorBoundary ...
│   ├── auth/                AuthBrandHero (auth page right pane)
│   └── shell/               AppShell / DesktopSidebar / GlobalBottomNav / TitleBar
├── contexts/                NewTripContext / ActiveTripContext / TripIdContext / TripDaysContext
├── hooks/                   useTrip / useApi / useDarkMode / useRequireAuth / useCurrentUser ...
├── lib/                     apiClient / mapRow / mapDay / mergePoi / drag-strategy ...
└── types/                   trip.ts / api.ts
```

### 狀態管理

無 Redux / Zustand。狀態拆三層：

1. **Server state** — `useTrip`（SWR-style fetch + cache），`useRequests`（SSE）
2. **Cross-component UI state** — React context（`DarkModeProvider`、`PermissionsProvider`）
3. **Local state** — `useState` / `useRef`，不外流

### CSS 架構

`css/tokens.css` 是**唯一** CSS 檔，用 Tailwind CSS 4 的 `@theme` 定義 tokens（色彩、字體、圓角、間距、V2 Terracotta 單一主題 + dark mode 變體）。Mockup 與 DESIGN.md 是 source of truth。元件一律用 utility classes；scoped styles 只用於 Tailwind 表達不了的 pseudo-element 或 dark mode 特例（見 `DayNav.tsx` 內的 `SCOPED_STYLES`）。詳見 [DESIGN.md](DESIGN.md)。

---

## Backend — Pages Functions

`functions/api/` 下的每個檔案對應一條 route。Cloudflare Pages 的約定：檔名與路徑結構決定 URL。

### 中介層（middleware chain）

`functions/api/_middleware.ts` 會在每個 request 進入前執行：

```
incoming request
  → detectSource()       從 header/cookie 判定 source（scheduler / companion / service_token / user_session / anonymous）
  → handleAuth()         V2 OAuth：(a) DEV_MOCK_EMAIL set → mock auth path；
                                    (b) tripline_session cookie → getSessionUser HMAC verify；
                                    (c) Bearer token (client_credentials) → opaque token lookup
  → CSRF check           mutating requests 驗 CSRF token (POST/PUT/PATCH/DELETE)
  → garbled text guard   驗 body 文字編碼（防亂碼 / CP950→UTF-8 誤轉）
  → AppError 攔截        所有 throw 統一包成 JSON 格式回應
```

**信任邊界重點**：`detectSource()` 的 source 是 **self-reported telemetry**，不是 auth decision。`X-Tripline-Source` / `X-Request-Scope` header 都可被偽造，消費端（如 daily-check）若要做 escalation 必須結合 path / error code 等 secondary signal，不能單憑 source gate。**Auth decision 走 `requireSessionUser()` 直接驗 cookie HMAC + `users` 表查 email**，不依賴中介層的 `data.auth` 設定（後者只給非敏感 endpoint 用）。

### 錯誤處理

`functions/api/_errors.ts` 定義 `AppError` class 與錯誤碼表。Handler **一律** `throw new AppError('CODE')`，不直接 `return json({error}, status)` — 中介層會統一轉成 response，保證 response shape 一致。

### Route 分類

```
functions/api/
├── _middleware.ts       入口中介
├── _auth.ts             auth helpers（isAdmin, requireAuth）
├── _audit.ts            寫 audit_log
├── _errors.ts           AppError + errorResponse
├── _poi.ts              POI COALESCE 合併邏輯（trip_pois overrides pois）
├── _types.ts            Env / shared types
├── _utils.ts            共用 DB / header helpers
├── _validate.ts         input validation + garbled guard
├── trips/               trips CRUD + batch days endpoint
├── pois/                POI CRUD（AI 維護的 master）
├── requests/            旅伴請求（含 SSE stream）
├── permissions/         trip_permissions CRUD
├── trips.ts             list trips
├── my-trips.ts          caller's accessible trips
├── requests.ts          top-level requests endpoint
└── reports.ts           error reports
```

---

## Data Model

D1 schema 演進在 `migrations/0001 ~ 0026*.sql`（含 `migrations/rollback/` 反向 SQL）。核心表：

### 行程結構（時間軸）

```
trips (1)
  └── trip_days (N)       每一天
        └── trip_entries (N)   每天的 timeline 條目
```

### POI（景點 / 餐廳 / 購物 / 飯店）— 雙層所有權

```
pois              AI 維護的 master。canonical 欄位（name, google_rating, phone, hours ...）
  ↓ 1:N
trip_pois         user 可覆寫的 per-trip layer
  ↓ N:N
poi_relations     多對多關聯（例如「某景點附近有哪些餐廳」）
```

**COALESCE convention**：讀 POI 資料時 `SELECT COALESCE(trip_pois.name, pois.name) AS name ...`。`trip_pois.name = NULL` 代表繼承 master；非 NULL 代表 user 覆寫。這讓 AI 更新 master 不會覆蓋 user 的 per-trip 客製。

### 權限與審計

| 表 | 用途 |
|----|------|
| `trip_permissions` | 誰可以看哪個 trip（email 清單） |
| `trip_requests` | 旅伴請求（改行程 / 問建議） |
| `audit_log` | 所有寫操作的追蹤 |
| `api_logs` | 錯誤日誌（`source` 欄位做分類） |
| `trip_docs` | 行程附件（機票、訂房 PDF）|

---

## Auth — V2 OAuth (sole auth, 取代 Cloudflare Access)

V2-P6 cutover 後 Cloudflare Access 已完全拆除，所有 auth 走 self-built V2 OAuth。

### 三種身份

1. **Anonymous** — 公開讀已發布 trip（middleware 不擋）
2. **User session** — `tripline_session` HMAC opaque cookie（自 `/signup` 或 `/login` 發）。Middleware `getSessionUser` verify 簽章 + 從 `users` 表查 email
3. **Service token (CLI / scheduler)** — `/api/oauth/token` `grant_type=client_credentials` (RFC 6749 §4.4) 取 opaque Bearer access_token (1h TTL)。`client_apps.allowed_scopes` 含 `admin` 即視為 admin
4. **Admin** — `email === ADMIN_EMAIL` (`lean.lean@gmail.com`) 或 service token 帶 admin scope

### Session token 結構

`tripline_session` cookie 是 `<base64url payload>.<base64url HMAC>` 格式（**非 JWT**，避免 alg=none / key-confusion / payload-edit 等慣性 sec issues）。Payload 含 `uid` / `iat` / `exp` / `csrf` / 可選 `sid`（多裝置 tracking）。簽算法 HMAC-SHA256，用 `SESSION_SECRET` env。

### V2 OAuth 端點

```
/api/oauth/signup            self-signup + email verification
/api/oauth/login             password login → issue session
/api/oauth/forgot-password   request reset link
/api/oauth/reset-password    token-gated password reset
/api/oauth/token             client_credentials → access_token
/api/oauth/authorize         OIDC authorize (3rd-party OAuth client)
/api/oauth/callback          Google OAuth callback
/api/oauth/userinfo          OIDC userinfo (returns user info given session)
/api/oauth/logout            clear session cookie + revoke session_devices row
/api/oauth/revoke            revoke access token
```

詳見 `functions/api/oauth/*.ts`。

### Edge vs App 驗簽

V2 cookie 在 **app 層**（middleware）驗 HMAC 簽章 + 比對 `users` 表。本機開發走 `.dev.vars` 的 `DEV_MOCK_EMAIL`（wrangler 讀此檔，**不是** `.env.local`）：middleware 直接 mock auth bypass，但敏感 endpoint（如 `/api/oauth/userinfo`）仍要求真 session cookie。

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

2. **POI 雙層所有權（pois + trip_pois）** — AI 會定期更新 master（phone 變了、google_rating 改了），但 user 可能在某 trip 客製描述或標籤。COALESCE 讓兩邊各自演進不互踩。

3. **V2 OAuth 取代 Cloudflare Access (2026-04 V2-P6 cutover)** — 早期 Cloudflare Access 省事，但綁 Cloudflare admin email + 無法支援 third-party OAuth client（`/developer/apps` 場景）。V2 self-built OAuth 用 opaque HMAC session cookie + RFC 6749 client_credentials 給 CLI；雖然多寫 password reset / verification flow，但能控制 OIDC server mode、multi-device sessions、connected-apps 全套體驗。session cookie 走 HMAC opaque 格式（非 JWT）避免 JWT 慣性 sec 問題（alg=none / key-confusion）。

4. **Tailwind CSS 4 + @theme，不用 CSS modules** — V2 Terracotta 單一主題（含 dark mode 變體）的 token 切換用 CSS custom property 最簡。元件層全用 utility class，減少 dead CSS。Mockup `terracotta-preview-v2.html` + `DESIGN.md` 是 source of truth。

5. **無 state management library** — 服務狀態（trip / requests）用 custom hook + SWR-style fetch；UI 狀態用 React context 或 local state。Redux / Zustand 對這規模是 overkill。

---

## Related Docs

- [README.md](README.md) — 使用者介紹、功能特色
- [CLAUDE.md](CLAUDE.md) — 開發流程、gstack pipeline
- [DESIGN.md](DESIGN.md) — 設計系統、視覺 tokens
- [CHANGELOG.md](CHANGELOG.md) — 版本紀錄
