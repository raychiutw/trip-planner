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
| Auth | Cloudflare Access（JWT cookie `CF_Authorization`）+ Service Token |
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
│  │  ├─ /trip/:tripId  → TripPage（旅伴瀏覽）                │  │
│  │  ├─ /manage/       → ManagePage（管理員）                │  │
│  │  └─ /admin/        → AdminPage（Admin: lean.lean@gmail）│  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS（Cloudflare edge）
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Cloudflare Access（edge auth gate）              │
│  /manage/* /admin/* 寫入 API → 驗 JWT，未授權阻擋                │
│  /trip/*（公開讀）→ 通過                                          │
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

`src/entries/main.tsx` 單一 SPA 入口，底下三個 page：

| Path | Component | 用途 |
|------|-----------|------|
| `/trip/:tripId` 或 `/` | `TripPage` | 旅伴瀏覽行程（唯讀）|
| `/manage/*` | `ManagePage` | 管理員修改行程、處理 requests |
| `/admin/*` | `AdminPage` | 全域管理（trips 發布、POI 維護）|

BrowserRouter 走 pretty URL（無 hash）。`/manage/` 與 `/admin/` 的 `dist/` 有 `index.html` 複本以支援 direct access（build step 在 `package.json` 內）。

### 目錄結構

```
src/
├── entries/main.tsx         SPA 入口
├── pages/
│   ├── TripPage.tsx         行程瀏覽（最複雜：scroll-spy、sidebar、sheets）
│   ├── ManagePage.tsx       行程管理
│   └── AdminPage.tsx        Admin
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
  → detectSource()     從 header/cookie 判定 source（scheduler / companion / service_token / user_jwt / anonymous）
  → JWT decode         從 CF_Authorization cookie 取 email（Cloudflare Access 已在邊緣驗過簽章）
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

D1 schema 演進在 `migrations/0001 ~ 0024*.sql`。核心表：

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

## Auth

### 三種身份

1. **Anonymous** — 公開讀 `/trip/:tripId`（若 trip 已發布）
2. **User (JWT)** — `CF_Authorization` cookie 由 Cloudflare Access 發。從 JWT payload 取 `email`，比對 `trip_permissions` 決定能看 / 能改哪些 trip
3. **Admin** — `email === 'lean.lean@gmail.com'`（硬編碼）or Service Token (`CF-Access-Client-Id` + `Secret`)

### Edge 驗簽 vs App 驗簽

Cloudflare Access 在**邊緣**就驗過 JWT 簽章。App 層的 `decodeJwtPayload()` 只 decode、不驗簽章。這在 CF Access 後安全，但**本機 dev** 沒有 CF Access 所以用 `.env.local` 的 `DEV_MOCK_EMAIL` 偽造 JWT payload。

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

3. **Cloudflare Access 而非 app-level auth** — 不想自己搞 session store、password reset、JWT rotation。CF Access 用 Google OAuth，比 app-level cheap 很多，缺點是綁 Cloudflare。

4. **Tailwind CSS 4 + @theme，不用 CSS modules** — 6 套主題（color theme × dark mode）的 token 切換用 CSS custom property 最簡。元件層全用 utility class，減少 dead CSS。

5. **無 state management library** — 服務狀態（trip / requests）用 custom hook + SWR-style fetch；UI 狀態用 React context 或 local state。Redux / Zustand 對這規模是 overkill。

---

## Related Docs

- [README.md](README.md) — 使用者介紹、功能特色
- [CLAUDE.md](CLAUDE.md) — 開發流程、gstack pipeline
- [DESIGN.md](DESIGN.md) — 設計系統、視覺 tokens
- [CHANGELOG.md](CHANGELOG.md) — 版本紀錄
