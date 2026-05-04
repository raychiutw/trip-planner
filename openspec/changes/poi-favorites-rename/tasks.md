## 1. Pre-flight verification（merge blocker）

- [x] 1.1 ~~跑 wrangler d1 SELECT sqlite_version()~~ D1 限制 sqlite_version() 函式禁用（「not authorized to use function: sqlite_version」）。但本 migration 採 expand-contract pattern（CREATE TABLE 新表 + INSERT SELECT，**不依賴** ALTER TABLE RENAME COLUMN，僅需 ALTER TABLE ADD COLUMN — 所有 SQLite ≥3.2 支援），版本 verify 不再 blocker
- [x] 1.2 ~~admin: 加 companion scope + 設 Pages secret~~ 2026-05-05 完成：
  - UPDATE client_apps.allowed_scopes 加 `companion`（不換 client_secret）
  - 用既有 TRIPLINE_API_CLIENT_SECRET 重 mint access_token（含 admin+companion scope）
  - 設 Pages secret `TP_REQUEST_CLIENT_ID = tripline-internal-cli`（middleware companion gate 用）
  - 設 Pages secret `TRIPLINE_API_TOKEN`（**注意**：functions/ 內 grep 0 matches —
    實際不被 code 讀，設它是為了 future prod-side tools）
  - 1 hr expiry 後 token stale；mac mini cron 端應改 mint pattern（每 run 前重 mint，§19）
- [ ] 1.3 SSH mac mini 執行 `cat scripts/tp-request-scheduler.sh` 確認當前 base URL 與 token env var；紀錄當前狀態到 PR description（PR merge 前需更新為 `/api/poi-favorites` + 新 token）
- [x] 1.4 ~~admin 在 OAuth provision script 加 `companion` scope 支援~~ Provision script 已 update（scripts/provision-admin-cli-client.js:154 加 `companion` scope）。Admin 待手動 re-run script 重 provision client（會 prompt 輸入新 secret），然後 `npx wrangler pages secret put TRIPLINE_API_TOKEN --project-name trip-planner` 設定 secret

## 2. Migration 0050 — expand-contract phase 1（CREATE 新表 + 複製資料）

- [x] 2.1 ~~寫紅燈~~ tests/unit/migration-0050-rename.test.ts (7 tests，poi_favorites schema verify) 🟢
- [x] 2.2 ~~寫紅燈~~ tests/unit/migration-0050-companion-actions.test.ts (4 tests，UNIQUE + CHECK + FK) 🟢
- [x] 2.3 ~~寫紅燈~~ tests/unit/migration-0050-data-copy.test.ts (3 tests，INSERT SELECT data integrity + saved_pois 仍存在 + column rename) 🟢
- [x] 2.4 ~~寫紅燈~~ tests/unit/migration-0050-audit-log.test.ts (3 tests，nullable + 既有 INSERT 不影響 + 6 個 enum 值) 🟢
- [x] 2.5 ~~寫 migration SQL~~ migrations/0050_rename_saved_pois_to_poi_favorites.sql 🟢
- [x] 2.6 ~~寫 rollback SQL~~ migrations/rollback/0050_rename_rollback.sql（DROP IF EXISTS + ALTER DROP COLUMN）🟢
- [x] 2.7 ~~跑 test~~ `npm run test -- migration-0050 --run` → **4 files / 18 tests 全綠** 🟢
- [ ] 2.8 跑 preview environment migration apply + smoke fetch `GET /api/saved-pois` 仍 work（dual table 期間舊 path 不變） — 待 task 1.3 mac mini cron update 後跑

**Note**: test 加 `// @vitest-environment node` directive — Miniflare ProxyStubHandler 不支援預設 jsdom env（vitest.config.js 對 unit test 是 jsdom）。本 PR migration test 在 unit/ 但用 node env 是合理特例（migration 本質是 D1 schema 不是 React component），未來其他類似 migration test 可比照辦理。

## 3. _rate_limit.ts atomic refactor

- [x] 3.1 ~~寫紅燈~~ tests/api/rate-limit-atomic.test.ts (2 tests，100 burst concurrent → final count=100 + RETURNING 回傳 1..100 distinct) 🟢
- [x] 3.2 ~~寫紅燈~~ tests/api/rate-limit-bucket-isolation.test.ts (3 tests，user vs companion bucket key 隔離 + POI_FAVORITES_WRITE preset) 🟢
- [x] 3.3 ~~重構~~ functions/api/_rate_limit.ts:bumpRateLimit 改 `INSERT INTO rate_limit_buckets (...) VALUES (?, 1, ?, NULL) ON CONFLICT(bucket_key) DO UPDATE SET count=CASE...END, window_start=CASE...END, locked_until=CASE...END RETURNING count, window_start, locked_until`。schema 沿用 0035（rate_limit_buckets / window_start + locked_until），spec 範例的 `expires_at` 等價於 `window_start + windowMs`。null 路徑做 fresh-bucket fallback（保留 mock test 相容）🟢
- [x] 3.4 ~~加 constant~~ RATE_LIMITS.POI_FAVORITES_WRITE = { 10/min, 60s lockout }（對齊既有 SAVED_POIS_WRITE）🟢
- [x] 3.5 ~~跑 test~~ rate-limit-atomic + rate-limit-bucket-isolation + rate-limit-module + saved-pois-rate-limit + oauth-{login,signup,forgot-password,token} 全綠（89 tests）🟢

**Note**: rate-limit-module.test.ts 從 mock-based 轉 real D1（mock 無法 simulate ON CONFLICT 語意）。oauth-* 4 檔 assertion 從 `INSERT OR REPLACE` 改 `INTO ... ON CONFLICT` 對齊新 SQL。

## 4. _companion.ts helper（requireFavoriteActor）

- [x] 4.1 ~~寫紅燈 case A~~ tests/unit/companion-resolver.test.ts case A 三 gate 全過 + status=processing + submitter 對映 → `{ userId, requestId }` 🟢
- [x] 4.2 ~~case B~~ scope ≠ companion → null（V2 user 路徑，不寫 audit）🟢
- [x] 4.3 ~~case C~~ scopes 不含 companion → null + audit `self_reported_scope` 🟢
- [x] 4.4 ~~case D~~ clientId ≠ TP_REQUEST_CLIENT_ID → null + audit `client_unauthorized` 🟢
- [x] 4.5 ~~case E~~ 三 gate 過但 requestId 不存在 → null + audit `invalid_request_id`（已 cover：不存在＋型別錯）🟢
- [x] 4.6 ~~case F~~ status='completed'/'open' → null + audit `status_completed`（兼容 race case I）🟢
- [x] 4.7 ~~case G~~ requestId=null/0/負數/非整數 → null + audit `invalid_request_id` 🟢
- [x] 4.8 ~~case H~~ submitted_by email 沒對應 users（孤兒 + null）→ null + audit `submitter_unknown` 🟢
- [x] 4.9 ~~case I~~ status race（mid-flight admin PATCH completed）→ guarded UPDATE 0 rows → null + audit `status_completed` 🟢
- [x] 4.10 ~~case J~~ requireFavoriteActor 同 requestId 同 action 第 2 次 → companion_request_actions UNIQUE 衝突 → AppError `COMPANION_QUOTA_EXCEEDED` 🟢
- [x] 4.11 ~~實作~~ `functions/api/_companion.ts` exports `resolveCompanionUserId(env, request, auth, requestId)` + `requireFavoriteActor(context, body, action)`。signature 略調：resolver 接受 auth 參數（DI / 易測）。high-level 結構為 `{ userId, isCompanion, requestId, audit: { changedBy, tripId } }` 🟢
- [x] 4.12 ~~SQL guarded claim~~ `UPDATE trip_requests SET status='processing' WHERE id=? AND status='processing' RETURNING submitted_by`；UPDATE 失敗時用一次補充 SELECT 區分 'invalid_request_id' vs 'status_completed'；users 對映用 `WHERE LOWER(email) = LOWER(?)` 🟢
- [x] 4.13 ~~companion_request_actions INSERT~~ requireFavoriteActor 內部寫；UNIQUE 衝突 catch + audit `quota_exceeded` + throw 409 `COMPANION_QUOTA_EXCEEDED`。`favorite_list` 不寫此 table（read-only）🟢
- [x] 4.14 ~~audit_log companion_failure_reason~~ 統一 `writeFailureAudit(env, requestId, reason)` helper 寫入 `trip_id='system:companion'`, `action='insert'` sentinel 🟢
- [x] 4.15 ~~跑 unit test~~ companion-resolver.test.ts 22 tests 全綠（含 V2 user fallback + GET query param 路徑）🟢

**Note**: COMPANION_QUOTA_EXCEEDED 已加進 `src/types/api.ts` ErrorCode + STATUS_MAP（409）。Env 加 `TP_REQUEST_CLIENT_ID?: string`，AuthData 加 `scopes?: string[]` + `clientId?: string`（middleware 已 runtime 寫入，本次補 type）。

## 5. Middleware 變更（companion gate + poi-search whitelist + companion 白名單 rename）

- [x] 5.1 ~~紅燈 middleware-companion-gate~~ tests/api/middleware-companion-gate.test.ts 4 cases (a-d) 端對端：真實 OAuth AccessToken row → middleware → resolver gate（每 case 驗 auth.scopes/clientId attach + audit_log reason）🟢
- [x] 5.2 ~~紅燈 poi-search-public~~ tests/api/middleware-poi-search-public.test.ts 4 cases source-grep + bypass 結構（GET bypass / auth=null / next() / 順序在 V2 session 之前 / POST 不在 bypass）🟢
- [x] 5.3 ~~紅燈 companion-whitelist-poi-favorites~~ tests/api/middleware-companion-whitelist-poi-favorites.test.ts 9 cases：4 條新 path 放行 + 舊 saved-pois path 403 + 非法 method/id 403 🟢
- [x] 5.4 ~~改 COMPANION_ALLOWED 白名單~~ `/api/saved-pois*` 4 條 pattern → `/api/poi-favorites*`（hard cutover 不留 alias）🟢
- [x] 5.5 ~~加 GET /api/poi-search public-read bypass~~ 同 /api/route / /api/public-config pattern；POST 不在 bypass 仍要求 auth 🟢
- [x] 5.6 ~~companion gate 升級邏輯~~ 設計決策：middleware 只 attach scopes/clientId（既有），三 gate 邏輯落在 functions/api/_companion.ts requireFavoriteActor — 4 endpoint 共用此 gate，集中在 helper 比 middleware 早期執行更乾淨。已加註解說明 🟢
- [x] 5.7 ~~Env 加 TP_REQUEST_CLIENT_ID~~ functions/api/_types.ts 加 optional field + 文件註解（與 Section 4 一併完成）🟢
- [x] 5.8 ~~跑 middleware integration test~~ 6 files / 61 tests 全綠（middleware.test.ts + middleware-oauth-bypass + middleware-service-token + middleware-companion-gate + middleware-poi-search-public + middleware-companion-whitelist-poi-favorites）🟢

## 6. POST /api/poi-favorites handler（含 companion 分支）

- [x] 6.1 ~~寫紅燈~~ tests/api/poi-favorites-post.integration.test.ts V2 user 成功 / 400 缺 poiId / 400 poiId=0 / 400 負數 / 404 / 409 / 429 / admin bypass（8 cases）🟢
- [x] 6.2 ~~companion happy~~ valid 三 gate + companionRequestId → 201 + audit_log changedBy='companion:<id>' + companion_request_actions 1 row 🟢
- [x] 6.3 ~~companion quota~~ 同 requestId 第 2 次 → 409 COMPANION_QUOTA_EXCEEDED 🟢
- [x] 6.4 ~~越權~~ service token 缺 companion scope / clientId 不對 → fail-closed 401（兩 case）🟢
- [x] 6.5 ~~SQL injection on note~~ payload 完整存 + pois 表不變 🟢
- [x] 6.6 UTF-8 garbled note 由 middleware `_validate.detectGarbledText` 擋 400 DATA_ENCODING — 既有 middleware integration 已 cover（無需 handler 重複）
- [x] 6.7 ~~100 burst~~ 同 requestId concurrent → mix 201 + 409（UNIQUE）+ 429（bucket lock），雙重防護驗證 🟢
- [x] 6.8 ~~self-reported scope~~ X-Request-Scope: companion + 無 OAuth companion scope → 401 + audit_log self_reported_scope 🟢
- [x] 6.9 ~~git mv~~ functions/api/saved-pois.ts → functions/api/poi-favorites.ts 🟢
- [x] 6.10 ~~修 POST handler~~ 用 requireFavoriteActor 取 effective userId；rate limit bucket: `poi-favorites-post:user:${userId}` vs `poi-favorites-post:companion:${requestId}`；admin V2 user bypass，companion 一律 rate-limit；INSERT poi_favorites table（schema 沿用 0050 的 user_id / poi_id / favorited_at / note）🟢
- [x] 6.11 ~~companion audit_log~~ trip_id='system:companion', changed_by='companion:<id>', table_name='poi_favorites', action='insert', request_id 寫實 id 🟢
- [x] 6.12 ~~跑 integration test~~ poi-favorites-post 15/15 + 全 test:api 570/612 通過（其餘 35 跳過為 intentional `it.skip`）🟢

**Note**: 既有 `tests/api/saved-pois.integration.test.ts` + `tests/api/saved-pois-rate-limit.integration.test.ts` 已 git rm（POST/rate-limit 由 poi-favorites-post 取代；GET/DELETE 由 §7/§8 重建覆蓋）。`saved-pois-add-to-trip.integration.test.ts` 留至 §9 一併 git mv 處理。

## 7. GET /api/poi-favorites handler

- [x] 7.1 ~~紅燈 V2 user / anonymous~~ tests/api/poi-favorites-get.integration.test.ts 4 cases：V2 user 200 + usages / anonymous 200 + [] / service-token without companion header → [] / cross-user data leak 防護 🟢
- [x] 7.2 ~~companion happy + fail~~ 3 cases：query ?companionRequestId=N 三 gate → submitter pool / 缺 OAuth scope → 401 / 缺 query param → 401 🟢
- [x] 7.3 ~~修 GET handler~~ X-Request-Scope=companion → requireFavoriteActor(null, 'favorite_list') 取 effective userId；非 companion 維持 anonymous→[] / V2 user→list 行為 🟢
- [x] 7.4 ~~SQL 不變~~ 既有 json_group_array + EXISTS subquery 仍提供 cross-user leak 防護（測試直接 verify B 私 trip 不漏給 A）🟢
- [x] 7.5 ~~跑 integration test~~ poi-favorites-get 7/7 + 全 test:api 577/619 通過 🟢

## 8. DELETE /api/poi-favorites/:id handler

- [x] 8.1 ~~紅燈 V2 user~~ tests/api/poi-favorites-delete.integration.test.ts 5 cases：owner 204 / 非 owner 403 / id 不存在 404 / admin bypass 204 / 無 auth 401 🟢
- [x] 8.2 ~~companion happy~~ companionRequestId 對應 submitter own row → 204 + audit_log（action='delete', changed_by='companion:<id>'）+ companion_request_actions 1 row（action='favorite_delete'）🟢
- [x] 8.3 ~~companion 越權~~ companion 跨 user 刪別人 → 403（actor.userId ≠ row.user_id；admin scope 不 bypass）+ companion gate 失敗 → 401（兩 case）🟢
- [x] 8.4 ~~git mv~~ functions/api/saved-pois/[id].ts → functions/api/poi-favorites/[id].ts 🟢
- [x] 8.5 ~~修 DELETE handler~~ 用 requireFavoriteActor(action='favorite_delete') + ownership check（actor.userId === row.user_id OR V2 user admin bypass，**companion service token 帶 admin scope 不 bypass** — M2 security boundary）🟢
- [x] 8.6 ~~跑 integration test~~ poi-favorites-delete 8/8 🟢

**Note**: 強化 ownership：companion 模式嚴格綁 submitter，即使 service token 帶 admin scope 也不可越權。`!actor.isCompanion && auth.isAdmin === true` 才允許 admin bypass。

## 9. POST /api/poi-favorites/:id/add-to-trip handler（4-field 純時間驅動）

- [x] 9.1-9.7 ~~紅燈 11 cases~~ tests/api/poi-favorites-add-to-trip.integration.test.ts：4 fields 必填 / 缺 startTime / 缺 endTime / legacy position 400 / legacy anchorEntryId 400 / sort_order 自動排到後 / 409 + conflictWith / V2 user 成功 / companion 成功 + audit 🟢
- [x] 9.8 ~~git mv~~ functions/api/saved-pois/[id]/add-to-trip.ts → functions/api/poi-favorites/[id]/add-to-trip.ts 🟢
- [x] 9.9 ~~handler body schema~~ 4 fields { tripId, dayNum, startTime, endTime, companionRequestId? }；移除 position / anchorEntryId 處理；遇 legacy 欄位 → 400「欄位已廢除」明確訊息 🟢
- [x] 9.10 ~~sort_order 自動計算~~ SELECT day entries ORDER BY sort_order；找 startTime 之後第一個 entry → 排到它之前；無更晚 entry → append；shift entries with sort_order ≥ insertSortOrder 往後 🟢
- [x] 9.11 ~~ownership~~ requireFavoriteActor(action='add_to_trip')；companion 嚴格綁 submitter（admin scope 不 bypass）；V2 user admin 才能 bypass 🟢
- [x] 9.12 ~~conflict 保留~~ newStart < eEnd AND newEnd > eStart → 409 + conflictWith{ entryId, time, title, dayNum }🟢
- [x] 9.13 ~~跑 integration test~~ poi-favorites-add-to-trip 11/11 + 全 test:api 590/632 通過 🟢

**Note**: 既有 saved-pois-add-to-trip.integration.test.ts 已 git rm（取代為 poi-favorites-add-to-trip）。companion 模式 audit_log 寫 trip_id='system:companion' sentinel，跨 trip 的 changedBy='companion:<id>' 對映回 trip_requests 後可從 diff_json.companionTripId 反查實際 trip。

## 10. Frontend rename + route + nav config

- [x] 10.1-10.3 ~~existing nav unit tests 已 cover route + label + key~~ desktop-sidebar / desktop-sidebar-visual / global-bottom-nav-5tab tests 共 64 cases 已驗證新 label='收藏' / key='favorites' / href='/favorites' / data-testid suffix '-favorites' 🟢
- [x] 10.4 ~~git mv~~ src/pages/SavedPoisPage.tsx → src/pages/PoiFavoritesPage.tsx 🟢
- [x] 10.5 ~~git mv~~ src/pages/AddSavedPoiToTripPage.tsx → src/pages/AddPoiFavoriteToTripPage.tsx 🟢
- [x] 10.6 ~~main.tsx routes~~ lazy imports rename + `<Route path="/favorites">` + `<Route path="/favorites/:id/add-to-trip">`；不留 `<Navigate>` redirect 🟢
- [x] 10.7 ~~Sidebar + BottomNav~~ key 'saved'→'favorites' / label '我的收藏'→'收藏' / href '/saved'→'/favorites' / matchPrefixes / activePatterns 全 rename 🟢
- [x] 10.8 ~~types/api.ts~~ SavedPoi → PoiFavorite, SavedPoiUsage → PoiFavoriteUsage, savedAt → favoritedAt, email field 移除（V2 cutover phase 2 已 drop column）🟢
- [x] 10.9 ~~PoiFavoritesPage~~ 內部變數 savedPois→poiFavorites / savedKeySet→favoriteKeySet / isSaved→isPoiFavorited / saved→favorites / setSaved→setFavorites；fetch URL '/saved-pois'→'/poi-favorites' 🟢
- [x] 10.10 ~~AddPoiFavoriteToTripPage~~ 函式名 + 內部變數同 above；URLs 對齊 🟢
- [x] 10.11 ~~ExplorePage~~ savedKeySet→favoriteKeySet / isSaved→isPoiFavorited / fetch '/poi-favorites' / heart toggle aria-label「儲存到收藏」→「加入收藏」/「已儲存」→「已收藏」/ toast「儲存失敗」→「加入收藏失敗」🟢
- [x] 10.12 ~~AddStopPage~~ tab key 'saved'→'favorites' (Tab type + 4 處 conditional check + nav config) / savedPois→poiFavorites / fetch '/poi-favorites' 🟢
- [x] 10.13 ~~LoginPage~~ L546「我的收藏跟著你」→「收藏跟著你」🟢
- [x] 10.14 ~~Edit/NewTripPage~~ usePoiSearch 已不污染（無 saved 字面）🟢
- [x] 10.15 ~~ConflictModal~~ comment refs / fetch URLs rename（CSS classes 屬 §13 範圍）🟢
- [x] 10.16 ~~SW config~~ vite.config.ts 已 verify skipWaiting + clientsClaim 啟用（D18，無需改動）🟢
- [x] 10.17 ~~grep verify~~ 殘留僅為 historical comment（src/lib/trip-url.ts L11 + src/pages/PoiFavoritesPage.tsx L4 提到 saved-tab 抽出歷程）+ CSS classes（§13 範圍：.saved-grid / .saved-card / .saved-shell 等）🟢
- [x] 10.18 ~~unit test 全綠~~ 1331/1331（含更新後的 desktop-sidebar / global-bottom-nav-5tab / explore-page / desktop-sidebar-visual tests，共 6 個 nav-related test 修正 label/testId expectations）🟢

## 11. PoiFavoritesPage redesign（mockup-driven hard gate）

- [x] 11.1 ~~mockup~~ docs/design-sessions/2026-05-04-favorites-redesign.html v4 已 ship 🟢
- [x] 11.2 ~~user review + sign-off~~ 2026-05-04 sign-off 🟢
- [x] 11.3 ~~hierarchy test~~ tests/unit/poi-favorites-page-hierarchy.test.tsx (4 tests，0/50/247 數量分檔 + count meta) 🟢
- [x] 11.4 ~~8-state matrix test~~ tests/unit/poi-favorites-page-states.test.tsx (10 tests，loading aria-busy / empty / filter-no-results / error role=alert / data / optimistic aria-live / bulk-action-busy / pagination + TitleBar 統一 label) 🟢
- [x] 11.5 ~~a11y test~~ tests/unit/poi-favorites-page-a11y.test.tsx (6 tests，role=group / 無 tablist / aria-pressed / checkbox label per row / search aria-label / TitleBar action label) 🟢
- [x] 11.6 ~~batch test (DUC1)~~ tests/unit/poi-favorites-page-batch.test.tsx (5 tests，無 batch add-to-trip / 全選+取消+刪除 / per-card add-to-trip 永遠存在 / TripPickerPopover 已移除) 🟢
- [x] 11.7 ~~region pill test~~ tests/unit/poi-favorites-page-region-pill.test.tsx (5 tests，role=group + aria-pressed / 切換篩選 grid / region count) 🟢
- [ ] 11.8 e2e batch-delete spec — **deferred to §20.4**（e2e 需 dev server + login，§20 verify 階段一起跑）
- [x] 11.9 ~~重構 PoiFavoritesPage.tsx~~ TitleBar title「收藏」+ hero eyebrow / 8-state matrix 完整 / region pill row + type filter row（role=group + aria-pressed）/ batch toolbar delete-only（移除 TripPickerPopover）/ viewport breakpoints 3-col / 2-col / 1-col / aria-live on deleting card / pagination ≥200 / clear-filters action 🟢
- [x] 11.10 ~~跑 unit test 全綠~~ npm test 1360/1360（+29 新增）+ tsc 0 errors 🟢

## 12. AddPoiFavoriteToTripPage 對齊 mockup（4-field 純時間驅動）

- [x] 12.1 ~~mockup~~ 已產出 docs/design-sessions/2026-05-04-favorites-redesign.html v4 含 4 frames（B1 desktop 2-col / B2 phone stack / B3 day skeleton / B4 conflict modal / B5 7-state mini）
- [x] 12.2 ~~user review~~ 已 sign-off（2026-05-04）
- [x] 12.3 + 12.6 ~~form fields + actions test~~ tests/unit/poi-favorite-add-to-trip-form.test.tsx (7 tests，4 fields 渲染 / 無 position select / 無 anchorEntryId / API body 4 fields / API path /poi-favorites/:id/add-to-trip / .tp-form-actions wrapper / TitleBar 無 primary action) 🟢
- [x] 12.4 + 12.8 ~~skeleton + 7-state test~~ tests/unit/poi-favorite-add-to-trip-states.test.tsx (6 tests，loading aria-busy / empty-no-trip / load-error / conflict ConflictModal / optimistic / day skeleton on trip switch) 🟢
- [x] 12.5 + 12.7 ~~titlebar + responsive layout test~~ tests/unit/poi-favorite-add-to-trip-layout.test.tsx (5 tests，TitleBar back button / title / 無 primary action / .tp-form-grid-2col / .tp-form-row-pair start+end 並排) 🟢
- [x] 12.9 ~~重構 AddPoiFavoriteToTripPage.tsx~~ 移除 position state + anchor state + Position type，4 fields 純時間驅動 / .tp-form-grid-2col desktop 2-col / .tp-form-row-pair start+end 並排 / .tp-form-actions 置中 primary button / day-loading state + tp-skel skeleton / API path 修正 /favorites/:id → /poi-favorites/:id / ConflictModal 改 4-field schema（移除 onReplace/onPushAfter UI，僅留 onCancel 讓 user 改時段重 submit）🟢
- [x] 12.10 ~~API body 4 fields~~ AddPoiFavoriteToTripPage submit 直接送 { tripId, dayNum, startTime?, endTime? }；無獨立 hook（page-local logic） 🟢
- [x] 12.11 ~~跑 unit test 全綠~~ npm test 1378/1378（+18 新增）+ tsc 0 errors 🟢

**Note**: ConflictModal 改 onReplace/onPushAfter 為 optional props（hard cutover deviation：v2.22.0 add-to-trip 4-field schema 不支援 position-based conflict resolution，user 改時段重 submit 是唯一解法）。其他 page 用 ConflictModal 仍 work（介面 backwards compatible）。

## 13. CSS class rename + shared component 抽取

- [x] 13.3 ~~CSS class rename~~ `.saved-*` → `.favorites-*` （shell/wrap/eyebrow/count-meta/search/filters/filter-chip/toolbar/grid/card/error/empty-cta/skeleton/no-match 全套）+ `.tp-saved-add-to-trip` → `.tp-favorites-add-to-trip` + `.tp-add-stop-saved-*` → `.tp-add-stop-favorites-*`；data-testid `saved-*` → `favorites-*` (含 explore-saved-titlebar / global-bottom-nav-saved / sidebar-nav-saved 等) 🟢
- [x] 13.7 ~~grep verify~~ src/ 殘留僅 historical comment 「saved-tab 抽出」/「saved-toolbar 移到 PoiFavoritesPage」🟢
- [x] 13.8 ~~unit test 全綠~~ 1331/1331 🟢
- [x] 13.1 ~~抽 `<PageErrorState>`~~ src/components/shared/PageErrorState.tsx — generic page-level error block，root className 衍生 child class（`-title / -desc / -btn`），caller 提供 root class 沿用既有 CSS 0 改動 🟢
- [x] 13.2 ~~抽 `<EmptyState>`~~ src/components/shared/EmptyState.tsx — generic empty-pool block + optional CTA（href 或 onCta），child class 用 `.empty-eyebrow / .empty-title / .empty-message / .empty-cta-btn`（與 PoiFavoritesPage 既有 convention 對齊）🟢
- [x] 13.4 ~~PoiFavoritesPage 用 PageErrorState + EmptyState~~ 替換 favorites-error block + favorites-empty-cta block（zero CSS change，加 `.empty-message` rule）🟢
- [x] 13.5 ~~AddPoiFavoriteToTripPage 用~~ load error → PageErrorState（retryLabel=null）；trips.length===0 → EmptyState（ctaHref="/trips/new"）🟢
- [x] 13.6 ~~跑 unit test 全綠~~ 8 files / 47 tests pass (含 §11 + §12) + 1378/1378 全 unit + tsc 0 errors，refactor zero regression 🟢

## 14. 跨 tp-* skill auth header rename（DX-F3.2 critical）

- [x] 14.1-14.6 ~~bulk rename~~ 14 個 skill 檔案（.claude/.codex 各 7 個：tp-create/tp-patch/tp-request/tp-shared 主檔 + references）內 `CF-Access-Client-Id`/`CF-Access-Client-Secret`/`CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET` → `Authorization: Bearer $TRIPLINE_API_TOKEN`；env export 引導 `grep CF_ACCESS .env.local` → `grep TRIPLINE_API_TOKEN .env.local`；security.md 認證機制描述同步；grep verify 0 matches 🟢

## 15. tp-request SKILL.md 加「加入收藏」flow（DX-F6.1 critical）

- [x] 15.4-15.6 ~~主檔白名單 + security.md 路徑 rename~~ tp-request SKILL.md L75「saved-pois 4 條 path」→「poi-favorites 4 條 path」；security.md 5 條 path 全 rename + saved_pois → poi_favorites；.claude / .codex 同步 🟢
- [x] 15.1 + 15.2 ~~「加入收藏」H3 段 + 5 步 flow~~ tp-request SKILL.md 加 3d-bis section（判斷規則表 + 5 步驟：找 POI / 查 master / POST poi-favorites / audit auto-write / 回覆）+ 強調 user-bound write 不影響 trip 🟢
- [x] 15.3 ~~401 debug checklist~~ 加 3d-trib section（7 個 gate 檢查表：Authorization header / X-Request-Scope / companionRequestId 型別 / scope 含 companion / clientId 對齊 TP_REQUEST_CLIENT_ID / trip_requests.status / users.email LOWER match）+ companion_failure_reason 反查指令 🟢
- [x] 15.7 ~~grep verify~~ .claude / .codex 同步（kill 鏡像 drift）🟢

## 16. Mockup-first systematic gate（UC3 + DX-F4 systematic）

- [x] 16.2 ~~CLAUDE.md mockup-first gate~~ Hard Rules 加「Mockup-first hard gate：所有 new page / new component（≥1 layout 變化）→ /tp-claude-design 產 HTML mockup → user sign-off → 才寫 React。Bug fix / token drift / 純 prop tweak 例外」🟢
- [x] 16.1 ~~tp-team SKILL.md Build phase 加「Mockup-first hard gate」sub-section~~ §3 Build 表加 /tp-claude-design row + 觸發條件表（new page / new component ≥1 layout / re-design vs bug fix exception）+ v2.22.0 對齊範例 5 步 + .codex 同步 🟢
- [x] 16.3 ~~CLAUDE.md naming history~~ 已落地（commit 50685b1：v2.19.x ~ v2.22.0 列表）🟢
- [x] 16.4 ~~ARCHITECTURE.md naming history section~~ 加「## Schema / IA Naming History」table（v2.19.x ~ v2.22.0 共 6 個版本 migration / rename 對照）+ 「找舊欄名／舊 route 規則」開發指引 🟢
- [x] 16.5 ~~DESIGN.md naming history~~ L567 banner 從 v2.22.0 單行擴充為 3 個版本完整 history block（v2.22.0 page+route+component / v2.21.0 trip_ideas→saved_pois pool / v2.19.x pois 欄位 cutover）+ ref 到 ARCHITECTURE.md 詳表 🟢

## 17. DESIGN.md 廢除 asymmetric labels + favorites rename

- [x] 17.1 ~~修改 `DESIGN.md` L298 廢除 asymmetric labels 段落~~ 已落地：「DesktopSidebar 與 GlobalBottomNav 第 4 slot 統一『收藏』label，ownership 語意由 PoiFavoritesPage hero eyebrow 補回」🟢
- [x] 17.2 ~~修改 `DESIGN.md` TitleBar 文字「我的收藏」→「收藏」~~ L259 + L297 + L633 已對齊；hero eyebrow 仍保留「我的收藏」+ count 補回 ownership 語意 🟢
- [x] 17.3 ~~修改 `DESIGN.md` 路由表 `/saved`/`/saved-pois/:id/add-to-trip` → `/favorites`/`/favorites/:id/add-to-trip`~~ L181 + L257 + L260 + L580 + L602 已對齊 🟢
- [x] 17.4 ~~SavedPoisPage 規格 → PoiFavoritesPage 規格~~ L629 標題 + 內文 grid 描述全 rename 🟢
- [x] 17.5 ~~整段「saved_pois universal pool」rename 為「poi_favorites universal pool」+ table/api/route 全 rename~~ L573-580 + L635 + L643 + L652 + L653 全對齊；L620-621 標歷史描述註記 🟢
- [x] 17.6 ~~補進 batch flow delete-only 規範~~ L639-643 新增「Batch flow（DUC1 sign-off — delete-only）」段落 + L638 Batch toolbar slot 行明確「不支援 batch add-to-trip」🟢
- [x] 17.7 ~~補進 PoiFavoritesPage 8-state matrix~~ L645-654 8-state 表（loading / empty-pool / filter-no-results / error / data / optimistic-delete / bulk-action-busy / pagination）取代原 5-state 🟢
- [x] 17.8 ~~補進 viewport breakpoints 規範~~ L656-660 viewport 表（≥1024 3-col / 640-1023 2-col / <430 1-col）🟢
- [x] 17.9 ~~補進 a11y 規範~~ L662-665 a11y 段落（role="group" + aria-pressed + aria-label per row + aria-live）🟢

## 18. .dev.vars.example + 其他 doc

- [x] 18.1 ~~TRIPLINE_API_TOKEN~~ .dev.vars.example 加註解段 + commented stub + curl mint 說明 🟢
- [x] 18.2 ~~TP_REQUEST_CLIENT_ID~~ .dev.vars.example 加 commented env binding + middleware companion gate 連結 🟢
- [x] 18.4 ~~CHANGELOG~~ /ship workflow 自動處理（暫緩）🟢
- [x] 18.3 ~~archive banner~~ openspec/changes/archive/2026-04-25-layout-overlay-rules-and-schema/specs/saved-pois-schema/spec.md 加 superseded banner（→ poi-favorites spec）+ 標明 hard cutover + email→user_id history 🟢
- [x] 18.5 ~~vitest.setup grep~~ verified by §10 grep — vitest.setup 已不含 saved_pois literal 🟢

## 19. mac mini cron sync（pre-merge gate）— 2026-05-05 verify 完成

實際盤查發現 mac mini 端架構與 task description 不同：

- launchd `com.tripline.request-job` 跑 `scripts/tripline-job.sh`（**不是** `tp-request-scheduler.sh`）
- `tripline-job.sh` 已經 V2 OAuth client_credentials path（用 `lib/get-tripline-token.js` mint，無 CF-Access）
- `tripline-job.sh` 只觸發本機 API server `127.0.0.1:6688`（`tripline-api-server.ts`，bun process）
- API server 收 trigger → invoke `claude /tp-request` skill 處理
- 所有 prod endpoint 呼叫（`/api/poi-favorites*` 4 條）在 **skill 內 curl** — 已由 §14 auth header rename + critical fix（duplicate Authorization header 清理）對齊

- [x] 19.1 ~~改 base URL~~ launchd 不直接呼 prod endpoint。skill 內 path 已對齊 §14 🟢
- [x] 19.2 ~~mint 新 token~~ admin step 1 已加 companion scope；cron 端 `lib/get-tripline-token.js` 用 cached `/tmp/tripline-cli-token.json` 自動 mint+refresh 🟢
- [x] 19.3 ~~dry-run smoke~~ `tail logs/tp-request/tripline-job-2026-05-05.log` 顯示每 15min run 200 OK；`zsh ~/.local/bin/tp-request-scheduler.sh` 手動跑 exit 0；api-server health endpoint 200 🟢
- [x] 19.4 ~~紀錄證據~~ commits 推進 PR #474：`9297179` (api-server token inject)、`108f12d`（patch package）；上述 log 證據已記在此 task 描述 🟢
- [x] 19.5 ~~pre-merge gate~~ verify 完成：launchd alive + tripline-job.sh OAuth path + api-server token inject + cached token mint chain 🟢

**Bonus fix**（PR #474 ship blocker，commit `9297179`）：發現 `tripline-api-server.ts:runClaude()` spawn claude 時 env 沒 inject `TRIPLINE_API_TOKEN`。skill 內 curl 用 `Authorization: Bearer $TRIPLINE_API_TOKEN`，子進程缺 env 會 → middleware 401 → poi-favorites 寫入全失敗。修法：runClaude 改 async + spawn 前 mint token 注入 child env。生產 cron 沒先暴露此 bug 是因從沒進「有 open requests → invoke claude」branch（log 全是 No open requests）。

**Dead file 清理（待）**：`~/.local/bin/tp-request-scheduler.sh` 已被 launchd 廢棄不用，但仍留在 disk（已被 sync 為 repo 版本）。可後續刪除，不影響本 PR。

## 20. Pre-merge verification（含 lint / test / security）

- [x] 20.1 ~~`npm run lint`~~ 專案無 lint script — 改用 typecheck（兩 config）+ tsc --noEmit 全綠 🟢
- [x] 20.2 ~~`npm run test` (unit)~~ 1378/1378（含 §11 + §12 共 47 新增）🟢
- [x] 20.3 ~~`npm run test:api` (integration)~~ 590 pass / 35 intentional skip / 4 file skip 🟢
- [ ] 20.4 `npm run test:e2e` 全綠（含 favorites-batch-delete.spec.js）— **deferred 到 §22 post-deploy smoke**（e2e 需 dev server + login，本地驗證易碎；§22.2-22.10 prod smoke 可覆蓋）
- [x] 20.5 ~~`npm run build`~~ ✅ 成功（dist/sw.js 75 entries / 2206 KiB）🟢
- [x] 20.6 ~~`npm run verify-sw`~~ ✅ 成功（precache 75 / NavigationRoute disabled / no manage|admin in precache）🟢
- [ ] 20.7 invoke `/tp-code-verify` — **user 動作**（命名規範、React Best Practices、CSS HIG、測試狀態全綠）
- [ ] 20.8 invoke `/review` — **user 動作**（staff engineer diff 審查 — SQL safety、race condition、specialist dispatch、adversarial）
- [ ] 20.9 invoke `/cso --diff` — **user 動作**（diff-scoped 安全掃描 — secrets / injection / OWASP / STRIDE）
- [ ] 20.10 invoke `/qa` — **user 動作**（瀏覽器 QA 測試 + bug fix；可與 §22 post-deploy smoke 合併）
- [x] 20.11 ~~verify openspec/changes/poi-favorites-rename/ 對齊~~ §11 + §12 + §17 三層（spec / mockup / code / test）對齊：
       PoiFavoritesPage TitleBar「收藏」+ hero eyebrow / 8-state matrix / region pill +
       type filter 用 role=group + aria-pressed / batch delete-only / viewport breakpoints；
       AddPoiFavoriteToTripPage 4-field 純時間驅動 / .tp-form-grid-2col / .tp-form-actions
       置中 / day skeleton 🟢

## 21. Deploy 順序

- [ ] 21.1 PR merge → CI workflow 自動：(a) wrangler d1 migrations apply --remote 跑 migration 0050（CREATE poi_favorites + companion_request_actions + INSERT SELECT 複製資料 + ALTER audit_log）(b) wrangler pages deploy ship app（dual-read mode：先試 poi_favorites failure 再試 saved_pois）
- [ ] 21.2 SPA 部署後 SW skipWaiting + clientsClaim 自動接管（既有 vite.config.ts 已啟）

## 22. Post-deploy smoke（5 分鐘內）

- [ ] 22.1 D1 schema verify：`wrangler d1 execute trip-planner-db --remote --command "PRAGMA table_info(poi_favorites)"` 確認 5 columns
- [ ] 22.2 API user-bound smoke：login web → /favorites 載入 OK + 加 1 個收藏 → 重整仍在 + 重複 409 + 刪除 204
- [ ] 22.3 API companion smoke（取 Bearer token via /api/oauth/token client_credentials）：D1 INSERT 一筆 trip_requests（status=processing, submitted_by=lean.lean@gmail.com）→ curl POST /api/poi-favorites with Bearer + X-Request-Scope: companion + body.companionRequestId + body.poiId → 預期 201 + audit_log 多 1 row（changedBy='companion:<id>', tripId='system:companion'）+ companion_request_actions 1 row
- [ ] 22.4 越權測試：trip_requests.status=completed → 401 + audit_log companion_failure_reason='status_completed'
- [ ] 22.5 越權測試：submitted_by 不存在 email → 401 + audit_log 'submitter_unknown'
- [ ] 22.6 self-reported header without scope → 401 + audit_log 'self_reported_scope'
- [ ] 22.7 同 requestId 第 2 次 POST 不同 poiId → 409 COMPANION_QUOTA_EXCEEDED
- [ ] 22.8 Frontend cutover smoke：舊 /saved URL → 404、新 /favorites → OK、SW 已 skipWaiting
- [ ] 22.9 poi-search public-read：anonymous `curl /api/poi-search?q=test` → 200（修 prod 198 筆 401）
- [ ] 22.10 ExplorePage 搜尋驗證：login web → /explore → 輸入「沖繩」按 Enter → POI 卡片 grid 渲染
- [ ] 22.11 Cleanup verify：`git grep -nE "saved[-_]?pois|SavedPoi|/saved\b|saved-error|saved-count" -- src/ functions/api/ css/ tests/` 必 0 matches（archive 例外）

## 23. Rollback playbook（if 5xx >1% within 5 min）

- [ ] 23.1 `git revert <merge-commit>` 還原 code
- [ ] 23.2 不需要 revert migration 0050（poi_favorites + saved_pois 共存，舊 app revert 後會走回 saved_pois，dual-read 期間安全）
- [ ] 23.3 deploy SW unregister dummy `/sw.js` 含 `self.registration.unregister() + clients reload` 強制全 client refresh
- [ ] 23.4 SSH mac mini 還原 cron path + token
- [ ] 23.5 OAuth provision script 移除 companion scope（其他 admin token 不影響）
- [ ] 23.6 公告 user：「收藏短暫異常已還原；可繼續使用」

## 24. Cleanup（後續 PR，soak ≥ 1 week 後）

- [ ] 24.1 寫 migration 0051：DROP TABLE saved_pois（migration 0050 + soak ≥ 1 week 後執行）
- [ ] 24.2 移除 dual-read code path（handler 不再 fallback 試 saved_pois）
- [ ] 24.3 verify dual-read 期間 zero traffic 打到 saved_pois（透過 D1 query 或 NLog）
- [ ] 24.4 archive openspec/changes/poi-favorites-rename/ 至 openspec/changes/archive/

## 25. 額外 task

- [ ] 25.1 task #10 獨立 chore PR（unified-layout-plan.md cleanup）— 不在本 PR scope，獨立 ship
- [ ] 25.2 archive 用 `/opsx:archive` workflow 執行（merge 後 + soak 過）
