# TODOs

已知待辦與 follow-up。按 Skill/Component 分組，每項標 Priority。

**Priority**：
- **P0** — 現在就該修（阻擋使用 / 資料損失 / 安全性）
- **P1** — 下一個 sprint 要修（明顯影響使用者體驗）
- **P2** — 有空就修（少數人踩到、體驗小瑕疵）
- **P3** — 想做再做（nice-to-have）
- **P4** — 可能不做（長期觀察）

---

## Lighthouse — Blocking gate（2 週 baseline 後）

**Current**: Lighthouse CI 已建立（PR #8），所有 assertion 為 warn 模式。
**Goal**: 2 週 baseline 資料收集後，將 warn 改為 error，設 blocking gate 阻擋效能 regression。
**步驟**:
1. 從 GitHub Actions artifact 收集 2 週 p50 / p95 數字
2. 計算合理閾值（p50 + 10% buffer）
3. `lighthouserc.json` assertions 由 `warn` 改 `error`
4. 評估是否需要 PR preview URL integration（vs. master only）
**Est**: 0.5 day CC（小）
**Priority**: P2（2 週後升 P1）

---

## Completed

### v2.30.3 — `.tp-action-btn` family extract (poi-favorites-rename §13 收尾)

**Priority:** P3
**Completed:** v2.30.3 (2026-05-15)

§13 Shared component 抽取最後一項 `tp-action-btn` family。3 子項：
- `<PageErrorState>`：已在 v2.29.x 抽出
- `<EmptyState>`：已在 v2.29.x 抽出
- `.tp-action-btn` family：本 PR 完成，universal CSS 在 `css/tokens.css`（BEM modifier `--ghost` / `--destructive`），PoiFavoritesPage 既有 `.favorites-toolbar-btn` 系列 + ExplorePage dead CSS 一併收掉

PoiFavorites destructive 從 `--color-priority-high-dot` fallback hack 改用 canonical `--color-destructive`，light/dark 視覺一致；新增 hover affordance（filter + destructive bg）對齊 ExplorePage 既有設計意圖。AddPoiFavoriteToTripPage scoped `.tp-action-btn` 是 large variant 留 follow-up。

### v2.30.2 — V2-P6 rate_limit_buckets cleanup cron

**Priority:** P3
**Completed:** v2.30.2 (2026-05-15)

`migrations/0035` 註解承諾的 hourly cleanup cron 終於兌現。採 `deploy.yml` 既有 pattern（GitHub Actions schedule + `wrangler d1 execute --remote`），免新增 Workers code，繞開 Pages Functions 不原生支援 `functions/_scheduled.ts` 的限制。`.github/workflows/rate-limit-cleanup.yml` 每整點跑 `DELETE FROM rate_limit_buckets WHERE locked_until IS NULL AND window_start + 3600000 < (unixepoch() * 1000)`。鎖中 rows 保留。失敗 Telegram 即時告警。

### v2.30.x — P3 OCC quick wins (3 items)

**Priority:** P3
**Completed:** v2.30.x (2026-05-14)
**PR:** [#538](https://github.com/raychiutw/trip-planner/pull/538)

3 個 P3 quick wins 並 ship：

1. **OCC parallelize**（perf）：`_entry_pois.ts` 4 個 OCC callsite (setMaster / addAlternate / removeAlternate / reorderAlternates) 把 pre-SELECT `getEntryPoisVersion()` 合進 snapshot `Promise.all` — sequential 2 RT 降到 1 RT。`syncEntryMaster` 無 pre-SELECT，skip。removeAlternate 順便修錯誤碼語意：OCC fail-fast 提前到 row null check 之前。**Note**：真正 atomic CAS via UPDATE RETURNING 跟 D1 batch atomicity 衝突，未實作；race-safety 由既有 UNIQUE constraint catch 保護。
2. **Day-level OCC**（feat + migration 0065）：`trip_days.version INTEGER` 加 OCC counter。PUT /days/:num 接受 optional `expectedDayVersion`，不符 → 409 STALE_ENTRY（複用 error code）。GET response 加 `version`、PUT response 加 `dayVersion`。`expectedDayVersion` undefined 略過 check，既有 client 不破。Frontend wire 留 follow-up。
3. **refreshEntryPois parallelize**（perf）：EditEntryPage `refreshEntryPois` 內 GET /entries + GET /days 並行 — 3 RT 降到 2 RT。GET /days/:num 仍 sequential。

### v2.30.0 — drop trip_segments.mode_source

**Priority:** P2
**Completed:** v2.30.0 (2026-05-14)
**PR:** [#536](https://github.com/raychiutw/trip-planner/pull/536)

`trip_segments.mode_source` 欄位 DROPPED — 移除「上鎖」概念。PATCH /segments/:sid 新 contract：`mode='transit'` 必填 min（source='manual'），`mode='driving'`/`'walking'` 一律 Google Routes 重算（ignore body.min）。recompute-travel skip 條件 `mode_source='user'` → `mode='transit'`。Frontend 拔 🔒 icon + isLocked 變數 + 「已手動覆寫」title indicator + 「重設為自動」button。CLAUDE.md / DESIGN.md / ARCHITECTURE.md Naming history 三檔同步加 v2.30.0 + v2.29.x entries。

### poi-favorites-rename — §15-§18 doc / skill items

**Priority:** P3
**Completed:** v2.29.x (2026-05-14)
**PRs:** [#532](https://github.com/raychiutw/trip-planner/pull/532) / [#533](https://github.com/raychiutw/trip-planner/pull/533) / `chore/p3-todos-cleanup-may15`

- §15 tp-request §3d-bis「加入收藏」curl flow + 401 debug 3-step checklist（PR #533）
- §16.1 tp-team SKILL.md Build phase「Mockup-first hard gate」section
- §16.3-§16.5 CLAUDE.md / DESIGN.md / ARCHITECTURE.md 三檔加 Naming history（已對齊 saved_pois→poi_favorites、trip_pois rip-out、mode_source DROPPED 全部歷史）
- §17 DESIGN.md asymmetric labels rewrite（L298, L317, L578-587, L647, L656, L696 全對齊新名稱與 mockup v4 sign-off）
- §18.3 saved-pois-schema archive banner Successor link 更新為 `openspec/changes/archive/2026-05-14-poi-favorites-rename/specs/poi-favorites/spec.md`

§13 Shared component 抽取（PageErrorState / EmptyState / tp-action-btn）尚未處理 — 留 follow-up，等 PoiFavoritesPage redesign PR 一併。

### poi-favorites-rename — Phase 2 DROP saved_pois

**Priority:** P2
**Completed:** v2.29.1 (2026-05-14)
**PR:** [#532](https://github.com/raychiutw/trip-planner/pull/532)

migration 0050 (v2.22.0, 2026-05-04) expand-contract 10 天 soak 過後 cleanup：

- §24.1 ~~Migration `0051` DROP TABLE saved_pois~~ — 改編 0063（0051 已被 google_maps_platform 占用）
- §24.2 dual-read code path 確認移除（grep 0 reads/writes in functions/）
- §24.3 verify zero traffic：`SELECT COUNT(*) FROM saved_pois WHERE saved_at > '2026-05-04'` → 0
- §24.4 archive openspec → `openspec/changes/archive/2026-05-14-poi-favorites-rename/`

### Tech debt — event name const-ize

**Priority:** P3
**Completed:** v2.29.0 (2026-05-14)
**PR:** [#530](https://github.com/raychiutw/trip-planner/pull/530)

新 `src/lib/events.ts` 集中 `EVENT.entryUpdated` / `segmentUpdated` / `tripUpdated` / `tripCreated` / `developerAppCreated`。13 個 src/ 檔案 import 替換 literal；test files 保留 raw strings 當 contract assertion（防 events.ts 改 literal 但 listener 漏改）。1532 unit tests pass。

### ChangePoiPage entry_pois_version OCC token

**Priority:** P2
**Completed:** v2.29.0 (2026-05-14)
**PR:** [#529](https://github.com/raychiutw/trip-planner/pull/529)

mount-time `GET /trips/:id/entries/:eid` 取 `entryPoisVersion` → submit body spread 進 `POST /alternates` 與 `PUT /poi-id` 兩個 mode。409 response 解析 `error.code`，區分 `STALE_ENTRY`（「資料已被其他操作更新，請重新整理」）與 `DUPLICATE_POI`（「此景點已存在於 stop 中」）給 user-friendly 訊息。+3 unit tests。

### Travel compute — Mapbox/ORS rip-out（過時 TODO）

**Priority:** P3
**Completed:** v2.23.0（hard cutover 到 Google Maps Platform — 2026-05-09）

TODO 文字描述「`/api/route` (Mapbox) + `src/server/travel/compute.ts` (ORS primary)」整段在 v2.23.0 `google-maps-migration` 一次全部 rip-out：Mapbox + ORS + OPENTRIPMAP + OSM Nominatim 全部移除，server-side single `GOOGLE_MAPS_API_KEY`（Places + Routes + Geocoding + Place Details）。`src/server/travel/compute.ts` + `src/server/routing/ors.ts` 兩個檔案在 v2.23.0 已 DELETE。`functions/api/_types.ts` 殘留的 `ORS_API_KEY` + `OPENTRIPMAP_API_KEY` env schema 已於 v2.29.0 PR #531 cleanup PR 一併拔除。

### EntryActionPage / AddStopPage snake/camel mismatch（過時 TODO）

**Priority:** P2
**Completed:** v2.21.0（2026-05-04 audit）

TODO 描述的 `d.day_num` / `d.day_of_week` / `d.entry_count` / `entryData.day_id` snake_case reads 早在 v2.21.0 已修為 camelCase（grep 確認 0 殘留）。Interface 內過時的「v2.21.0 修為 camelCase」歷史 comment 已於 v2.29.0 PR #531 cleanup PR 一併移除。

### v2.28.x Restaurants → alternates Phase 2

**Priority:** P1
**Completed:** v2.29.0 (2026-05-14)
**PR:** [#527](https://github.com/raychiutw/trip-planner/pull/527)

v2.29.0 trip_pois rip-out 一次 cutover 完成 Phase 2 全部 items：
- migration 0021 (v2.5) 早已 `DROP TABLE restaurants`；本次 audit 確認 prod 無此 table（item 4 已完成）
- `scripts/migrate-0059-restaurants-to-alternates.ts` + `meal-stop-primary-poi-backfill` helper/tests 一併刪除（CHANGELOG v2.29.0 Removed section）
- `Day PUT` 拒絕舊格式 `restaurants` / `stop_pois` / `poi` → `DATA_VALIDATION`（item 3 `raw.restaurants → infoBoxes` 路徑移除）
- canonical response 只回 `master` / `alternates` / `stopPois` / `entryPoisVersion`，dual-state drift 不再可能（item 2 monitoring SQL 不再需要）

### v2.27.x Multi-POI Phase 2 (items 1-4)

**Priority:** P1
**Completed:** v2.29.0 (2026-05-14)
**PR:** [#527](https://github.com/raychiutw/trip-planner/pull/527)

- ✅ Item 1: migration 0062 DROP `trip_entries.poi_id`，setMaster() 不再 dual-write
- ✅ Item 2: `_entry_pois.ts` 移除 `UPDATE trip_entries SET poi_id = ?` line + entry.poi_id selector fallback retire
- ✅ Item 3: `_merge.ts` 拔掉 entryPoiIdx + dual-batch（檔案重構後不存在）
- ✅ Item 4: `src/types/trip.ts` Entry.poi / Entry.poiId 移除（dead fields）

### ChangePoiPage alternate mode unit coverage

**Priority:** P2
**Completed:** v2.28.3 (2026-05-13)

`tests/unit/change-poi-page.test.tsx` covers `?mode=alternate` with both 搜尋 and 收藏 tabs. Search results post find-or-create payloads to `/alternates`; favorites post `{ poiId }` from the same screen.

### Middleware service-token auth bypass — non-admin service token 繼承 ADMIN_EMAIL

**Priority:** P0
**Completed:** v2.21.0 (2026-05-04 audit confirmed)
**PR:** [#467](https://github.com/raychiutw/trip-planner/pull/467)（v2.21.0「service-token security」）

`functions/api/_middleware.ts:355-358` 對非 admin scope service token 改用 `email = service:${client_id}` sentinel（不再繼承 `ADMIN_EMAIL`）。`hasPermission` SQL lookup 用 sentinel email 在 `trip_permissions` 找不到任何 row → grant denied。Audit log `changed_by` 反映 sentinel 不偽造 admin identity。Integration test `tests/api/middleware-service-token.integration.test.ts`（v2.21.0 MF7）cover non-admin service token + 別人的 trip → 403 + audit attribution sentinel。

### EntryActionPage GET /api/trips/:id/entries/:eid 在 prod 不存在 (405)

**Priority**: P1
**Completed**: v2.19.13 (2026-05-03)
**PR**: fix/entry-action-get-405-and-edit-trip-form-id

`functions/api/trips/[id]/entries/[eid].ts` 補 `onRequestGet` (auth + hasPermission + verifyEntryBelongsToTrip + SELECT id, day_id, title)。EntryActionPage move/copy 不再 405 → 「找不到這筆資料」alert，flow 解鎖。Integration tests 加 4 個 cover 200/401/404x2。e2e Flow 7 仍 PASS (mock GET 對齊真 API contract)。

**Discovered & deferred**: 同一個 page 還有 snake/camel mismatch (P2，看上方新 entry)。

### EditTripPage bottom 「儲存變更」 button form="edit-trip-form" 無對應 form id

**Priority**: P3
**Completed**: v2.19.13 (2026-05-03)
**PR**: fix/entry-action-get-405-and-edit-trip-form-id

`src/pages/EditTripPage.tsx:576` form 加 `id="edit-trip-form"` (1 line)。bottom 「儲存變更」 button click 現在正確觸發 form submit。e2e Flow 5 加新 test lock bottom button → PUT。

### OIDC discovery routing 錯亂（V2-P5 critical bug）

**Priority:** P0
**Completed:** v2.19.x (2026-05-02 audit) — V2-P5 routing fix 已上線，`functions/api/oauth/authorize.ts` header 確認「Public OIDC path 對齊 discovery doc。Internal Google login 在 `/api/oauth/login/google`」。`token.ts` / `revoke.ts` / `userinfo.ts` / `jwks.json.ts` 全在位。tests/api/oidc-discovery.test.ts 12/12 pass — discovery routing 已 healthy，原 TODO 為過時記錄。

### DayNav 日期 pill 等寬

**Priority:** P2（使用者回報）
**Completed:** v1.2.4.0 (2026-04-17)
**PR:** [#190](https://github.com/raychiutw/trip-planner/pull/190)

使用者回報：4 字元日期 pill（`7/29`、`7/30`、`7/31`）63px 寬，3 字元（`8/1`、`8/2`）52px 寬，一排大小不一。改 `min-w-tap-min` → `min-w-[4.5em]`（相對 em，mobile 60px / desktop 90px，兩邊都等寬），加上 `tabular-nums` 讓數字字形等寬避免左右抖動。保留 44px 觸控下限（4.5em 一定 > 44px）。

### DayNav sliding indicator 移除

**Priority:** P2（使用者回報）
**Completed:** v1.2.3.9 (2026-04-17)
**PR:** [#189](https://github.com/raychiutw/trip-planner/pull/189)

PR #187 把 spring overshoot 改成 Apple ease-out 仍不滿意 — 只要 `translateX` 有 350ms 動畫就會經過中間 pill，使用者要求「移除這個效果」。直接砍掉整個半透明 indicator layer（`useState` + `useLayoutEffect` + JSX div），active pill 本身實心 `bg-accent` 已足夠辨識。DayNav.tsx 322 → 297 行。

### DayNav 指示器 spring overshoot 污染隔壁 pill

**Priority:** P2（使用者回報，非原 TODOS 項目）
**Completed:** v1.2.3.8 (2026-04-17)
**PR:** [#187](https://github.com/raychiutw/trip-planner/pull/187)

使用者捲動時發現「紅框處有個底圖變大效果」。根因：sliding indicator 的 easing 是 `cubic-bezier(0.32, 1.28, 0.60, 1.00)`（`--ease-spring`，y1=1.28 overshoot 28%），切換日期時 `translateX` 衝過目標 pill 到隔壁格短暫停留再彈回，加上 `width` 也 spring overshoot，視覺上像隔壁 pill 被錯標成 active 背景。改用 `--transition-timing-function-apple`（`cubic-bezier(0.2, 0.8, 0.2, 1)`，Apple HIG ease-out 無 overshoot）。`--ease-spring` token 保留給 `InfoSheet` / `QuickPanel` 的 bottom sheet 彈出動畫（那裡 overshoot 是對的 UX）。

### TODOS #5 誤報：docs/daily-report-flow.png 存在

**Priority:** P3（誤報）
**Completed:** 2026-04-17（`docs/todos-cleanup` PR）

原先註記 README.md:47 `docs/daily-report-flow.png` 可能缺失。實際檢查 `docs/` 目錄存在且 `daily-report-flow.png`（196KB）、`daily-report-flow-wide.png`、`daily-report-flow.html` 都在。此 TODO 為誤報，無需處理。

### TODOS #2：daily-check todayISO timezone regression test

**Priority:** P2
**Completed:** v1.2.3.7 (2026-04-17)
**PR:** [#185](https://github.com/raychiutw/trip-planner/pull/185)

把 `daily-check.js` 內聯的 `todayISO()` 抽到 `scripts/lib/local-date.js` 共用模組（支援注入時間），補 6 條單元測試覆蓋 PR #171 的原 bug 現場（凌晨 06:13 本地時間屬「今天」而非 UTC 前一天）+ 月日邊界。時區無關，CI runner 任何 TZ 穩定。

### TODOS #1 #3 #4 #7：scroll spy 4 個 follow-up

**Priority:** P2 / P3 / P3 / P4
**Completed:** v1.2.3.6 (2026-04-17)
**PR:** [#184](https://github.com/raychiutw/trip-planner/pull/184)

- **#1 Mobile URL bar 抖動**：新增 `getStableViewportH()` 用 `documentElement.clientHeight` (layout viewport)，mobile Chrome/Safari 捲動時 URL bar 收縮不再造成 active pill toggle
- **#3 Print mode scroll listener**：onScroll effect 加 `isPrintMode` 依賴 + 進入 print mode early return
- **#4 scrollDayRef 跨行程 stale**：`handleTripChange` reset ref
- **#7 單天行程 hash**：新增 `computeInitialHash()` pure function，初次載入自動推 `#day{today}` 或 `#day{first}` fallback

加 8 條單元測試覆蓋 pure function（viewport 穩定性、hash fallback 邊界）。

### TODOS：DayNav scroll spy 閾值標錯日

**Priority:** P1
**Completed:** v1.2.3.5 (2026-04-17)
**PR:** [#182](https://github.com/raychiutw/trip-planner/pull/182)

捲動到 Day N header 完整顯示在 sticky nav 下方時 active pill 仍停在 Day N−1。閾值從 `navH + 10` 改為 `navH + (innerHeight − navH) / 3`，並抽成 `src/lib/scrollSpy.ts` pure function + 10 條 regression test。

### TODOS：防止 GET /days/undefined 404

**Priority:** P1
**Completed:** v1.2.3.4 (2026-04-16)
**PR:** [#180](https://github.com/raychiutw/trip-planner/pull/180)

`fetchDay` 加 `Number.isInteger` 守門避免 undefined/NaN 發出 API 請求。

### TODOS：CI 自動 apply D1 migrations

**Priority:** P1
**Completed:** v1.2.3.3 (2026-04-13)
**PR:** [#178](https://github.com/raychiutw/trip-planner/pull/178)

關閉 Cloudflare Pages 部署 worker 但 D1 schema 未更新的 race window。
