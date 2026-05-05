## Why

旅伴 request 181「將 MARUMARO 北谷店 加入收藏」處理失敗 — `_middleware.ts` companion scope 白名單放行 saved-pois 但 `saved-pois.ts:67` 強制 `auth.userId`，service token user_id 為 null 直接拒絕。`tp-request/security.md` 描述的「companion scope user 對映」實際未實作。同時 D1/API/前端命名 `saved` 與 UI 中文「收藏」語意不對齊（saved 偏「儲存暫存」非「我喜愛想記住」），且現有頁面未對齊 DESIGN.md token 規範。Prod api_logs 198 筆 `GET /api/poi-search` 全 401（middleware public-read 白名單漏列），導致 ExplorePage / AddStopPage / EditTripPage / NewTripPage 全部搜尋失效。

## What Changes

- **BREAKING**: D1 table `saved_pois` rename 為 `poi_favorites`、column `saved_at` rename 為 `favorited_at`，採 expand-contract pattern（先建新表 + dual-read app deploy → soak → drop 舊表）避免 migration → app deploy 順序 100% 5xx 窗口
- **BREAKING**: API path `/api/saved-pois*` 全 rename 為 `/api/poi-favorites*`（4 條 endpoint：POST / GET / DELETE / add-to-trip）
- **新增** companion user mapping 機制：tp-request scheduler 透過 `body.companionRequestId + X-Request-Scope: companion + scope=companion + clientId=TP_REQUEST_CLIENT_ID` 雙重門禁（不再單看 self-reported header）解析為 user_id，讓旅伴「加入收藏」request 能自動處理
- **新增** `companion_request_actions(request_id, action, poi_id) UNIQUE` log table，限制 1 request : 1 action（防同 requestId 灌爆 favorites pool）
- **新增** OAuth client_credentials grant 的 `companion` scope，provision script 加新 scope，僅 mac mini cron 取得
- **修正** `_middleware.ts` 將 `GET /api/poi-search` 加入 public-read 白名單（修 prod 198 筆 401 search 失敗）
- **修正** `_rate_limit.ts` 改 atomic `INSERT ... ON CONFLICT DO UPDATE`（read-then-replace 不 atomic 風險），companion bucket key 與 user web bucket 分離
- **修正** `audit_log.trip_id NOT NULL` 對 companion 寫入相容：用 `tripId='system:companion'` sentinel
- **修改** 4 個 endpoint 統一用 `requireFavoriteActor(context, requestId)` helper，取代 4 處 copy-paste
- **修改** UI label 全部統一「收藏」（廢除 DESIGN.md L298 asymmetric「我的收藏」/「收藏」設計），eyebrow 補 ownership 語意「YOUR FAVORITES POOL / 你的跨行程收藏池」
- **修改** PoiFavoritesPage redesign：補 region pill filter、token drift 6 項對齊（`tp-page-eyebrow`、`tp-skel`、`tp-empty-cta`、`PageErrorState`、`EmptyState`、`tp-action-btn` family）、5-state matrix 升級為 8-state（補 bulk-action busy / pagination / 409 conflict / filter-no-results / batch-add-conflict-recovery）、a11y 修正（`role="tab"` 改 `role="group"` + `aria-pressed`）
- **修改** AddPoiFavoriteToTripPage 對齊 DESIGN.md L578-612 6-field form + 7-state matrix + phone sticky bottom action bar
- **修改** Frontend route：`/saved` → `/favorites`、`/saved-pois/:id/add-to-trip` → `/favorites/:id/add-to-trip`（hard cutover，不留 backward-compat redirect）
- **修改** Batch flow scope reduce 為 delete-only（add-to-trip 仍走 per-card link）
- **修改** tp-request SKILL.md 加 H3 段「3d.j 加入收藏 sub-flow」含完整 curl + decision rule（top-level discoverability，TTHW < 5min）
- **修改** 跨 tp-* skill auth header 同步：tp-shared/references.md / tp-edit / tp-create / tp-rebuild / tp-patch / tp-search-strategies 所有 `CF-Access-Client-Id` rename 為 `Authorization: Bearer $TRIPLINE_API_TOKEN`（V2 OAuth client_credentials grant）
- **新增** 系統化 mockup-first hard gate：寫進 `.claude/skills/tp-team/SKILL.md` Build phase + 根目錄 `CLAUDE.md`，所有新 page/component 強制走 `/tp-claude-design` → user sign-off → React 流程
- **新增** server-side companion failure 結構化 log：`audit_log.companion_failure_reason` field 寫真實原因（`invalid_request_id` / `status_completed` / `submitter_unknown` / `self_reported_scope` / `client_unauthorized`），client 維持 401 + uniform message（debug 友善 + oracle 防護兼顧）
- **修改** error response body 加 `documentationUrl` + `requiredHeaders` hint field

## Capabilities

### New Capabilities

- `poi-favorites`: POI 收藏池能力。使用者跨 trip 的 POI 收藏池（取代既有 `saved_pois` 邏輯），含 4 個 endpoint（POST 新增、GET 列出 with usages、DELETE 移除、POST add-to-trip fast-path）、UNIQUE `(user_id, poi_id)` 約束、批次刪除 UI、加入行程 fast-path、頁面 8-state matrix。
- `tp-companion-mapping`: tp-request scheduler 的 companion user 對映能力。透過 `body.companionRequestId + X-Request-Scope + scope=companion + clientId` 雙重門禁解析為 user_id，配 `requireFavoriteActor` helper 給 4 個 poi-favorites endpoint 使用，含 replay 防護（status guarded claim）+ 越權防護 + rate limit 隔離 + audit trail。
- `poi-search-public-read`: `GET /api/poi-search` 公開讀取能力。OSM Nominatim proxy，純讀取無 user data，需在 middleware public-read 白名單列出（同 `/api/route` / `/api/public-config` pattern），anonymous 可呼叫。

### Modified Capabilities

- `tp-request-injection-guard`: 既有 companion scope 白名單與 prompt injection 規範。本 change 補上實際的 companion-to-user mapping 邏輯（既有 spec 描述但未實作），並從 self-reported header 升級為雙重門禁（scope + clientId）。
- `terracotta-page-layout`: 既有頁面 layout 規範。本 change 廢除 L298 asymmetric labels（DesktopSidebar「我的收藏」/ GlobalBottomNav「收藏」），統一為「收藏」+ eyebrow 補 ownership；新增 PoiFavoritesPage 8-state matrix + viewport breakpoints（1024+ 3-col / 640-1023 2-col / <430 1-col）+ a11y 規範。

## Impact

**Affected code**：
- D1 schema：`migrations/0050_*.sql` + `migrations/rollback/0050_*.sql`，含 `companion_request_actions` 新表（搭配 expand-contract pattern 中段 0051）
- Backend：`functions/api/_middleware.ts`（白名單 + companion scope gate + poi-search public-read）、`functions/api/_companion.ts`（新 helper）、`functions/api/_rate_limit.ts`（atomic INSERT ON CONFLICT）、`functions/api/saved-pois.ts` → `poi-favorites.ts`（rename + companion 分支）、3 個 sub-endpoint 對應 rename
- Frontend：`src/pages/SavedPoisPage.tsx` → `PoiFavoritesPage.tsx`、`AddSavedPoiToTripPage.tsx` → `AddPoiFavoriteToTripPage.tsx`、`src/entries/main.tsx` route、`src/components/shell/DesktopSidebar.tsx` + `GlobalBottomNav.tsx`、`src/types/api.ts`、`src/hooks/usePoiSearch.ts` 不變但驗證、`ExplorePage.tsx` + `AddStopPage.tsx` + `EditTripPage.tsx` + `NewTripPage.tsx` 變數 rename、`LoginPage.tsx` 文案
- CSS：所有 `.saved-*` rename 為 `.favorites-*`，移除 `SavedPoisPage` inline `<style>` 改 `css/pages/poi-favorites.css`
- Tests：`tests/api/saved-pois*.test.ts` × 3 → `poi-favorites*.test.ts`，補 6 security cases（SQL injection note / UTF-8 garbled / poiId=0 / self-reported companion / cross-user requestId / burst 100）+ migration 0050 schema integrity test + companion resolver 6 cases；e2e `qa-flows.spec.js` route update
- Skill：`.claude/skills/tp-request/`（SKILL.md + references/security.md）+ `.codex/skills/tp-request/` 鏡像、`tp-shared/references.md`（auth header）、跨 tp-* skill 6 處 grep rename、`.claude/skills/tp-team/SKILL.md`（mockup-first systematic gate）
- Doc：`DESIGN.md`（L298 廢除 asymmetric、L317/484/565-657 saved → favorites + Naming history section）、`CLAUDE.md`（mockup-first gate + Naming history）、`ARCHITECTURE.md`（Naming history）、`CHANGELOG.md`（v2.22.0）、`.dev.vars.example`（TRIPLINE_API_TOKEN stub）
- 既有 archive：`openspec/changes/archive/2026-04-25-layout-overlay-rules-and-schema/specs/saved-pois-schema/` 加 banner 指向新 capability
- Cron：`scripts/tp-request-scheduler.sh` 硬編碼路徑必須在 mac mini 同步 update（pre-merge gate SSH verify）

**APIs / Dependencies**：
- D1 SQLite 版本必須 ≥ 3.25 才支援 `ALTER TABLE RENAME COLUMN`（pre-flight 跑 `SELECT sqlite_version()` verify）
- `TRIPLINE_API_TOKEN` 必須 provisioned（pre-flight gate）
- OAuth provision script 加 `companion` scope
- 服務外部依賴：OSM Nominatim（`/api/poi-search` proxy 不變）、Mapbox Directions（`/api/route` 不變）

**Systems**：
- Cloudflare Pages SPA + Workers Functions（單一大 PR ship 全 stack；user 確認承擔 30+ 檔 review/rollback 風險）
- D1 prod database（一次 migration apply，配 expand-contract 避免 5xx 窗口）
- mac mini cron（tp-request scheduler；token + path 必須同步 update）

**Breaking changes 緩解**：
- API 全 hard cutover（user 確認 dogfooding-only 可接受）
- SPA service worker `skipWaiting + clientsClaim` 已啟（`vite.config.ts`），rollback playbook 含 SW unregister 步驟
- 不留 `/saved` 或 `/api/saved-pois*` alias（user 確認）
