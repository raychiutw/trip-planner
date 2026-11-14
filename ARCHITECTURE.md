# Architecture

Tripline 的系統組成、資料流、信任邊界與部署拓撲。想改東西前先看這份，確保新增的 code 落在對的層次。

> **2026-11-09（#1627）：舊入口已刪除。** 本 repo 不再有 API——後端是 [trip-planner-api](https://github.com/raychiutw/trip-planner-api)（Cloudflare Workers，`/api/*`、OAuth、D1 migration 與排程清理都在那邊）。Pages 只剩 SPA 靜態資產，加上 `/s/:token`、`/trip/*` 兩支 OG meta Function。下文凡提到 `functions/api/`、`src/server/` 的敘述是拆分前的歷史描述，程式已不在本 repo。

使用者介紹請看 [README.md](README.md)。設計系統與視覺規範請看 [DESIGN.md](DESIGN.md)。開發流程請看 [AGENTS.md](AGENTS.md)。

---

## Tech Stack

| 層 | 技術 |
|----|------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4（tokens.css @theme 為唯一 CSS 入口）|
| Routing | React Router v6（BrowserRouter，SPA 單入口）|
| Backend | 獨立的 [trip-planner-api](https://github.com/raychiutw/trip-planner-api)（Cloudflare Workers）；本 repo 的 Pages Functions 只剩 `functions/s`、`functions/trip`（OG meta）|
| Database | Cloudflare D1（SQLite on the edge）|
| Auth | OAuth PKCE + Bearer（由 trip-planner-api 簽發與驗證，見 [ADR-0011](docs/adr/0011-split-web-api-agent-and-bearer-token.md)）|
| Build | Vite（SPA），Wrangler（Pages 本機模擬）|
| Testing | Vitest + @testing-library（unit / integration），Playwright（e2e）|
| Observability | Sentry（Vite plugin + runtime），NLog → D1 `api_logs` table |
| CI/CD | GitHub Actions + Cloudflare Pages auto-deploy |

---

## High-Level Topology

```
┌──────────────────────────────────────────────────────────────────┐
│                       使用者瀏覽器                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React SPA (src/entries/main.tsx, BrowserRouter)         │  │
│  │  4-tab IA: 聊天 / 行程 / 地圖 / 收藏 + 帳號 sheet       │  │
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
│  │ index.html + JS/CSS   │      │ /s/*、/trip/* OG meta（無 /api）│ │
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

`src/entries/main.tsx` 單一 SPA 入口，4-tab IA + 帳號 sheet + 多 sub-route。完整 route table
見 main.tsx，主要 group:

| Path group | 用途 |
|-----------|------|
| `/trips`, `/trip/:tripId/*` | 行程 list + TripLayout (含 collab / health / edit / add-* / stop edit) |
| `/chat`, `/map`, `/explore`, `/favorites` | global 4-tab pages (有 ActiveTripContext) |
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
│   ├── trip/                TimelineRail（拆 RailRow / EntryTimeChip / RailRowMenu / StopPoiChoiceCard）/
│   │                        DayNav / DaySection / TripMapRail / DayMap ...
│   └── shared/              Icon / Toast / ErrorBoundary / PageNav ...
├── hooks/                   useTrip / useTripRead（useTripMeta／useTripDays／useTripDestinations）/ useConversation / useDarkMode / usePrintMode / usePermissions ...
├── lib/
│   ├── apiClient.ts         統一 fetch wrapper（處理 AppError）
│   ├── entryMutations.ts    entry 變更：動詞 module（createEntry/setMaster/deleteEntry/...）回 Result，
│   │                        emit entryUpdated + 依 day scope 觸發車程重算，見 GLOSSARY.md「entry 變更」
│   ├── tripMutations.ts     行程層變更：archiveTrip/unarchiveTrip/deleteTrip/deleteDay 回 Result，
│   │                        成功 emit tripUpdated；不 toast、不導覽（同 entryMutations 慣例）
│   ├── segmentMutations.ts  手動車程建立／更新，成功 emit segmentUpdated 觸發共用讀取
│   ├── travelRecompute.ts   車程重算 single-flight、gap signature、403 停用與失敗狀態
│   ├── mapRow.ts            DB row → UI object 統一轉換
│   ├── scrollSpy.ts         純函式：捲動位置 → active day index
│   └── ...                  localStorage、sentry、timelineUtils
└── types/                   trip.ts / api.ts
```

### 狀態管理

無 Redux / Zustand。狀態拆三層：

1. **Server state** — `useTrip`（SWR-style fetch + cache），`useRequests`（SSE）
2. **Cross-component UI state** — React context（`DarkModeProvider`、`PermissionsProvider`）
3. **Local state** — `useState` / `useRef`，不外流

`useTripSegments` 是 segment 讀取與自動補算的共同入口。TripPage provider 共用一次讀取給時間軸與日區塊；獨立編輯頁自行讀取。entry/segment 更新會使舊讀取失效，完成新讀取後才判定相鄰 entry 的缺口，並交由 `travelRecompute` 按 day scope 去重與回報待更新狀態。
`segmentMutations.saveSegment` 負責兩個手動編輯入口的 POST／PATCH 與成功事件；版本重試及表單錯誤提示留在各入口。刷新結果由 `useTripSegments` 處理，不改寫已成功的儲存結果。
`useMyTrips` 依使用者共用 `/my-trips` 清單讀取、同時請求、刷新與最新結果；`useTripSelection` 將清單與 `ActiveTripContext` 偏好接合。聊天、行程清單、行程明細、root 地圖、行程地圖與側欄沿用同一清單與偏好；明確 URL／行程 sheet 目標仍優先，存取權由實際行程讀取判定。失敗讀取不確認空清單。root `/map` 只導向選定行程地圖或顯示空狀態，days、pins 與 Google 地圖操作留在 `/trip/:id/map`。桌機 `/trips` 的上次檢視行程及日期還原留在清單頁，手機仍先呈現清單。

### CSS 架構

`css/tokens.css` 是**唯一** CSS 檔，用 Tailwind CSS 4 的 `@theme` 定義 tokens（色彩、字體、圓角、間距）。**Single-theme**：只有 `body.dark` 與 `body.theme-print` 兩個覆寫，不是多主題系統（`tests/unit/tokens-css.test.ts` 鎖住此不變量）。元件一律用 utility classes；scoped styles 只用於 Tailwind 表達不了的 pseudo-element 或 dark mode 特例（見 `DayNav.tsx` 內的 `SCOPED_STYLES`）。

---

## Backend

API 在 [trip-planner-api](https://github.com/raychiutw/trip-planner-api)，本 repo 沒有後端程式碼。web 只打新 api（`.env.production` 的 `VITE_API_BASE_URL`）。

本 repo 的 Pages Functions 只剩兩支，都不是 API，只查 D1（`wrangler.toml` 的 `DB` binding）注入 OG meta：

| 路徑 | 用途 |
|------|------|
| `functions/s/[token].ts` | `/s/:token` 分享頁；token 無效／撤銷／過期或任何錯誤都回原 SPA shell，不得 500 |
| `functions/trip/[[path]].ts` | `/trip/:id` 行程連結預覽；查無行程回 404 HTML |

兩者共用的最小部分（`Env`、`resolveActiveShare`）在 `functions/_shared/share.ts`。`public/_routes.json` 只讓 `/trip/*`、`/s/*` 進 Functions，其餘全由 CDN 直接回靜態資產。行為由 `tests/unit/og-pages-functions.test.ts` 與 `tests/unit/old-entry-removed.test.ts` 鎖住。

---

## Data Model

D1 schema 的歷史基準在 `migrations/`（至 0101，含 `migrations/rollback/`；**凍結，不再新增**，新 migration 一律進 trip-planner-api）。核心表：

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

Entry 顯示名稱以 `trip_entry_pois.sort_order=1 -> pois.name` 為 canonical source；`trip_entries.title` 已於 v2.55.22 / migration 0081 DROP。

**已 DROP** (v2.29.x migration 0061-0063):
- `trip_pois` 整表 — 之前 COALESCE pattern (trip_pois overrides pois) 已過時
- `saved_pois` → 改名 `poi_favorites` (v2.22.0 migration 0050)

**POI 讀寫**: backend（trip-planner-api）用 `findOrCreatePoi(db, data, opts)`（`opts.policy` 為
`'keep'` 或 `'fill-null'`）+ `syncEntryMaster` / `addAlternate` / `setMaster`。**建立 entry** 一律經 entry intake（`createEntry` /
`createEntriesBatch`／`replaceDayEntries`）。整日重寫由 `replaceDayEntries`
一次提交 entries、junction、備選資料、hotel／parking 與版本；其他建立入口保留共用 intake，
見 `GLOSSARY.md` 的「entry intake」詞條。

### Google Maps Platform stack (v2.23.0+)

OSM / Nominatim / Overpass / OpenTripMap / Wikidata / ORS / Haversine fallback 全 ripped out
(v2.23.0 hard cutover, no fallback)。改：

Google Places／Routes proxy、kill switch、enrich 端點都在 trip-planner-api；每日 refresh、backfill、quota monitor 排程在 `trip-planner-agent`（mac mini launchd）。

### 權限與審計

| 表 | 用途 |
|----|------|
| `trip_permissions` | 誰可以看哪個 trip（email 清單） |
| `trip_requests` | 旅伴請求（改行程 / 問建議）。`status` 說結束了沒、`terminal_reason` 說為什麼結束（migration 0092），讀取端兩個都要看 —— 見 [ADR-0007](docs/adr/0007-request-termination-cancel-and-reap.md) |
| `audit_log` | 所有寫操作的追蹤 |
| `api_logs` | 錯誤日誌（`source` 欄位做分類） |

### Trip Notes (v2.34.0+, v2.57.75 AI ownership, v2.57.76 worker contract) — trip-level metadata 5 sections + AI generation

行程筆記（航班 / 住宿 / 預訂 / 行前須知 / 緊急聯絡）trip-level metadata 集中入 Tripline，user 不再切換 TripIt / Notion / Wanderlog。對齊 design doc `~/.gstack/projects/raychiutw-trip-planner/ray-master-design-20260528-144009.md`。

```
trip_flights              航班 (純手動，9 col + version OCC)
trip_lodgings             住宿 (純手動，可選 day_id ON DELETE SET NULL)
trip_reservations         預訂 (5-kind CHECK enum)
trip_pretrip_notes        行前須知 (AI 可生；origin / managed_by / semantic_key 區分來源、維護者與主題)
trip_emergency_contacts   緊急聯絡 (AI 可生；7-kind CHECK enum + 同一組 AI ownership 欄位)
trip_note_ai_exclusions   已刪 AI 主題的排除 tombstone；恢復只移除 tombstone
trip_note_ai_jobs         每 trip + doc_type 的 generation / status / timeout / result summary
```

**AI generation 3 prompts**：
- `lodging-tips`（住宿在地建議）→ INSERT trip_pretrip_notes with ai_source='lodging-tips'
- `tips`（一般行前須知）→ INSERT trip_pretrip_notes with ai_source='general-tips'
- `emergency`（緊急聯絡）→ INSERT trip_emergency_contacts with kind narrowed

Trigger flow（CR-7 + CR-8 pattern）：
1. POST `/api/trips/:id/notes/:type/generate` → INSERT `trip_requests` + 建立該 `doc_type` 的新 generation；同類型已有 active job 時沿用，三種類型彼此可平行。
2. Fire-and-forget trigger api-server（8s AbortController for CF Edge → Tailscale Funnel cold path），job 依序為 `pending` → `processing`；10 分鐘未完成時先轉 `timed_out`，再將關聯 request 標記 `failed`，避免 late completion 與 stale queue。
3. Mac mini api-server tp-request skill 對三種行程筆記 message 走最高優先 JSON-only contract → PATCH `/requests/:id` with strict JSON reply，不直接寫入筆記。
4. PATCH hook `applyNotesGenerationCompletion` 以 authoritative request/job linkage、generation 與 active status 驗證 callback；舊 callback 或錯誤／空輸出不改既有資料。
5. D1 batch 只替換同類型且 `managed_by='ai'` 的舊項目；人工維護項目、同主題人工項目與 exclusion tombstone 都保留／略過，完成後記錄新增、替換、保留人工、排除與略過數量。

AI ownership：
- AI 來源項目第一次編輯前先轉成 `managed_by='human'`，後續重新生成不可覆蓋；使用者可明確「交還 AI 維護」。
- 刪除 AI 來源項目時，同一 transaction 寫入 `trip_note_ai_exclusions`，後續生成不再重複；「恢復」只解除排除，須等下一次重新生成才可能再次出現。
- 人工建立／維護的項目也有 canonical `semantic_key`，生成時同主題直接略過，不建立重複項目。

**Frontend** `src/pages/TripNotesPage.tsx`（route `/trip/:tripId/notes`）：5 section accordion，mobile 預設展 航班，desktop ≥768px 全展開。`<FlightsSection>` / `<LodgingsSection>` / `<ReservationsSection>` / `<PretripSection>` / `<EmergencySection>` 每 section 獨立 component 處理 CRUD + autosave OCC + drag-reorder。三個 AI job 獨立顯示進度、逾時／失敗重試與完成摘要；行前須知、緊急聯絡各有「已排除 N 項」對話框，可逐項恢復。

**Tests**：
- migration 0091 schema/legacy ownership、API callback/race/排除/恢復、前端 job 狀態與 ownership UI、Trip Notes E2E 都有針對性回歸測試；避免維護容易過期的固定總數。

---

## Auth (v2.32+ V2 OAuth)

### 三種身份

1. **Anonymous** — 公開讀 `/trip/:tripId` (若 trip 已 published)
2. **User (V2 OAuth session)** — 自建 signup / login / forgot / reset / verify 流程，issue
   `tripline_session` opaque cookie (HMAC SHA-256 sig with HKDF-derived sub-key,
   v2.33.59 round 13)。session table `oauth_models` (D1) 維護裝置 list + revocation。
3. **Service Token** — Bearer token via OAuth client_credentials grant (RFC 6749 §4.4)，
   給 scheduler / admin tooling 用（實作在 trip-planner-api）。

> 認證實作（session／JWT 驗證、本機 dev 的 mock 登入）已隨舊入口刪除；現行認證見 trip-planner-api 與 [ADR-0011](docs/adr/0011-split-web-api-agent-and-bearer-token.md)。

---

## Deployment

### 部署觸發

```
git push master
  └─→ Cloudflare Pages webhook
        → npm run build（Vite SPA build）
        → 自動部署到 trip-planner-dby.pages.dev
```

web 的 CI 不再套用 D1 migration（`deploy.yml` 已於 #1627 刪除）；schema 的權威是 trip-planner-api 的 `migrations/`。D1 的排程清理（rate limit、過期分享、邀請）也在 api 的 Cron Trigger，不在這裡。

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
| Daily health | `trip-planner-agent` 的 `scripts/daily-check.js` + Gmail API | Telegram（紅燈推播）|

---

## Testing

兩層測試，`npm test` 跑 unit，e2e 要手動：

```
tests/
├── unit/                  vitest（node／jsdom 兩個 project）
│   ├── lib / hooks / component 的邏輯
│   └── e.g. scroll-spy.test.ts, tokens-css.test.ts, og-pages-functions.test.ts
└── e2e/                   playwright
    ├── trip-page.spec.js, offline.spec.ts
    └── 跑 `npm run test:e2e`（需要本機 dev server）
```

API 的整合測試（miniflare + 真 D1）隨舊入口刪除，現在在 trip-planner-api repo。

---

## Key Architectural Decisions

「為什麼是這樣」的決策記錄在 **`docs/adr/`** — 每條一檔，可個別標記 superseded（散文清單做不到）。索引：

| ADR | 決策 |
|-----|------|
| [0001](docs/adr/0001-poi-master-per-entry-alternates.md) | POI master + per-entry 備選，拔掉 trip-scoped override 中間層（v2.29.0） |
| [0002](docs/adr/0002-self-hosted-v2-oauth.md) | 自建 V2 OAuth，不用 Cloudflare Access（v2.21.x） |
| [0003](docs/adr/0003-tailwind-4-theme-tokens.md) | Tailwind CSS 4 + `@theme`，不用 CSS modules |
| [0004](docs/adr/0004-no-state-management-library.md) | 不引入 state management library |
| [0005](docs/adr/0005-google-maps-platform-only.md) | 全套切換 Google Maps Platform，不留 fallback（v2.23.0，2026-05-23 鎖死） |
| [0006](docs/adr/0006-occ-scoped-to-multi-poi-entry.md) | OCC 只用在 entry 的 multi-POI（v2.27.0） |
| [0007](docs/adr/0007-request-termination-cancel-and-reap.md) | 請求終結：取消＝停止等待，終結原因獨立成欄、兩層收屍 |
| [0008](docs/adr/0008-published-trips-are-fully-public.md) | 已發布行程對匿名讀者全公開：隱私邊界畫在『筆記區塊』，不在行程本體 |
| [0009](docs/adr/0009-account-deletion-requires-fresh-google-reauth.md) | 刪除帳號需伺服器驗證的近期 Google 重新驗證，無法驗證就 fail-closed（**已被取代**，2026-11-08 #1643：Google 登入移除，刪除只走密碼確認，無密碼 fail-closed） |
| [0010](docs/adr/0010-mobile-oauth-public-client-callback-contract.md) | Mobile OAuth 是 public client，callback 與 client 依環境精確綁定、用 HTTPS app link |
| [0011](docs/adr/0011-split-web-api-agent-and-bearer-token.md) | 拆成 web、api、agent 三個專案，認證改 bearer token（Accepted 2026-11-02；web 尚未切換、無 WAF，含殘留風險） |
| [0012](docs/adr/0012-ai-data-consent-requester-and-owner.md) | AI 資料同意：送出者與行程 owner 雙方持有，server 端把關（Accepted；文案欄位待補） |
| [0013](docs/adr/0013-selection-style-tonal-bg-solid-icon.md) | 選取樣式：淡柔褐 accent-bg 底 + `--color-selected-fg` + 實心圖示，取代實心 accent-fill 膠囊（Accepted 2026-11-14，#1707） |

新決策**新增 ADR**，不要改回寫在這裡；被推翻的舊決策標 superseded、不要刪。

---

## Schema / IA Naming History

過去 6 個版本的破壞性 rename / cutover（**hard cutover, no aliases**）。撞到 spec drift / 舊 sample code 時對照。

| Version | Migration | 變更 |
|---------|-----------|------|
| **v2.55.22** | 0081 | `trip_entries.title` DROPPED — entry 顯示名稱 hard cutover 到 primary POI name（`trip_entry_pois.sort_order=1 -> pois.name`）。POST entry contract 改用 `name`，舊 `title` payload 直接 400；clone/import/copy/rollback/health-check/favorite add-to-trip 全移除 title 讀寫。 |
| **v2.30.0** | 0064 | `trip_segments.mode_source` DROPPED — 移除「上鎖」概念。PATCH /segments/:sid contract 重寫：`mode='transit'` 必填 min（`source='manual'`，不打 Routes），`mode='driving'`/`'walking'` 一律 Google Routes 重算（ignore `body.min`, `source='google'`）。recompute-travel skip 條件 `mode_source='user'` → `mode='transit'`；response field `pairsSkippedUser` → `pairsSkippedTransit`。Frontend 移除 🔒 icon、isLocked 變數、「已手動覆寫」title indicator、EditEntryPage「重設為自動」button。 |
| **v2.29.x** | 0061-0063 | `trip_pois` 整表 rip-out（v2.29.0 / migration 0061+0062）：所有 alternates/master/hotel/shopping/restaurant 統一進 `trip_entry_pois` + `trip_days.hotel_poi_id` + `poi_relations`。`DROP TABLE saved_pois`（v2.29.1 / migration 0063，poi-favorites-rename Phase 2 — 10 天 soak 後）。Stale-travel ⚠ 偵測改用 `segment.computed_at IS NULL` signal（v2.29.2，拔 Haversine vs distance divergence 邏輯）；daily-check `queryRequestErrors` 移除 stale SELECT `trip_requests.mode`（v2.29.3）。 |
| **v2.22.0** | 0050 | `saved_pois` table → `poi_favorites`；route `/saved` → `/favorites`；API `/api/saved-pois` → `/api/poi-favorites`；`SavedPoisPage` → `PoiFavoritesPage`；`AddSavedPoiToTripPage` → `AddPoiFavoriteToTripPage`；CSS class `tp-saved-*` → `tp-favorites-*`。AddPoiFavoriteToTripPage 改 4-field 純時間驅動（廢 position + anchorEntryId）。Cross-skill auth header `CF-Access-*` → `Authorization: Bearer $TRIPLINE_API_TOKEN`。companion gate（middleware + `_companion.ts` requireFavoriteActor）+ `companion_request_actions` UNIQUE table 防 quota abuse + audit_log `companion_failure_reason` field。 |
| **v2.21.3** | 0049 | `trip_requests.mode` column DROPPED（phase 2，標準 swap idiom）。tp-request skill 改 auto-classify intent，不再 dispatch by mode field。 |
| **v2.21.2** | 0048 | `trip_requests.mode` 改 nullable + drop CHECK constraint（phase 1 of mode rip-out）。 |
| **v2.21.0** | 0046+0047 | `trip_ideas` table 退場 → `saved_pois` 升 universal pool（跨 trip 願望清單）；`trips.owner_email` → `owner_user_id` cutover（V2 OAuth 對齊）；`saved_pois.email` / `trip_permissions.email` DROPPED；UNIQUE constraint 改 `(user_id, ...)`。0047 採 backup-restore pattern（trips/pois 有 children FK）。 |
| **v2.20.0** | 0046 phase 1 | `trip_ideas` table 退場 phase 1；tp-request mode rip-out 啟動。 |
| **v2.19.x** | 0045 | `pois.google_rating` → `rating`；`pois.maps` DROPPED；`trips.{auto_scroll,og_description,footer,food_prefs,is_default,self_drive}` DROPPED。 |

**找舊欄名 / 舊 route 規則**：grep 整個 codebase 後 fail → 對照表確認是否已 rename → 改用新名 → 不要寫 alias。新需求與規格走 GitHub Issues；現行架構以本文件、程式碼與測試為準。

---

## Related Docs

- [README.md](README.md) — 使用者介紹、功能特色
- [GLOSSARY.md](GLOSSARY.md) — 領域詞彙（ubiquitous language）、已退場的名字對照
- [docs/adr/](docs/adr/) — 架構決策記錄（為什麼是這樣）
- [AGENTS.md](AGENTS.md) — Matt Pocock 官方技能流程與 Tripline 發布規則
- [CLAUDE.md](CLAUDE.md) — 專案事實、命名歷史與非衝突的 agent 規則
- [DESIGN.md](DESIGN.md) — 設計系統、視覺 tokens
- [CHANGELOG.md](CHANGELOG.md) — 版本紀錄
