## 1. Pre-flight verification（merge blocker）

- [x] 1.1 ~~跑 wrangler d1 SELECT sqlite_version()~~ D1 限制 sqlite_version() 函式禁用（「not authorized to use function: sqlite_version」）。但本 migration 採 expand-contract pattern（CREATE TABLE 新表 + INSERT SELECT，**不依賴** ALTER TABLE RENAME COLUMN，僅需 ALTER TABLE ADD COLUMN — 所有 SQLite ≥3.2 支援），版本 verify 不再 blocker
- [ ] 1.2 ⚠️ pre-flight gap：Pages prod 只有 `TRIPLINE_API_SECRET`（outbound to mac mini API server），缺 `TRIPLINE_API_TOKEN`（inbound from mac mini cron tp-request → /api/poi-favorites）。**admin 需 mint 含 admin+companion scope 的 client_credentials token + 加進 Pages env 為 `TRIPLINE_API_TOKEN` secret**（task 1.4 提供 provision script update，admin 跑 script 後手動 set Pages secret）
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

- [ ] 3.1 寫 `tests/api/rate-limit-atomic.test.ts` 紅燈：100 burst concurrent INSERT 同一 bucket → assert count 精確等於 100（無 read-then-replace race underflow）
- [ ] 3.2 寫 `tests/api/rate-limit-bucket-isolation.test.ts` 紅燈：同 user A 在 user bucket 滿（10/min）後，assert companion bucket 不受影響（不同 key）
- [ ] 3.3 重構 `functions/api/_rate_limit.ts`：bumpRateLimit 改 `INSERT INTO rate_limits (bucket, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET count = CASE WHEN expires_at < unixepoch() THEN 1 ELSE count + 1 END, expires_at = CASE WHEN expires_at < unixepoch() THEN ? ELSE expires_at END RETURNING count, expires_at`
- [ ] 3.4 加 `RATE_LIMITS.POI_FAVORITES_WRITE` constant（同既有 SAVED_POIS_WRITE 值，rename）
- [ ] 3.5 跑 unit test 全綠

## 4. _companion.ts helper（requireFavoriteActor）

- [ ] 4.1 寫 `tests/unit/companion-resolver.test.ts` 紅燈，case A: scope=companion + clientId match + scopes 含 companion + valid requestId + status='processing' + submitter 對映 user → 回 `{ userId, isCompanion: true, requestId, audit: { changedBy, tripId } }`
- [ ] 4.2 同檔案 case B: scope ≠ companion → 回 null（V2 user 路徑）
- [ ] 4.3 case C: scope=companion 但 scopes 不含 companion → fail-closed null + audit_log companion_failure_reason='self_reported_scope'
- [ ] 4.4 case D: scope=companion + scopes 含 companion 但 clientId ≠ TP_REQUEST_CLIENT_ID → fail-closed null + audit_log 'client_unauthorized'
- [ ] 4.5 case E: 三 gate 過但 requestId 不存在 → fail-closed + audit 'invalid_request_id'
- [ ] 4.6 case F: requestId 存在但 status='completed' → guarded UPDATE WHERE 不符 → fail-closed + audit 'status_completed'
- [ ] 4.7 case G: requestId 為負數 / 非整數 / 字串 / 0 → fail-closed + audit 'invalid_request_id'
- [ ] 4.8 case H: submitted_by email 沒對應 users → fail-closed + audit 'submitter_unknown'
- [ ] 4.9 case I: status race（A 進 helper 同時 admin PATCH 到 completed）→ guarded UPDATE 0 rows → fail-closed
- [ ] 4.10 case J: 同 requestId 同 action 第 2 次呼叫（companion_request_actions UNIQUE 衝突）→ helper 拋 409 `COMPANION_QUOTA_EXCEEDED`
- [ ] 4.11 寫 `functions/api/_companion.ts` exports `resolveCompanionUserId(env, request, requestId)` + `requireFavoriteActor(context, body, action)` 兩個函式
- [ ] 4.12 SQL 用 guarded claim：`UPDATE trip_requests SET status='processing' WHERE id=? AND status='processing' RETURNING submitted_by`，再 LEFT JOIN users (LOWER email)
- [ ] 4.13 加 `companion_request_actions` INSERT step（INSERT 失敗 → 409 拋出）
- [ ] 4.14 失敗路徑統一寫 audit_log `companion_failure_reason` field
- [ ] 4.15 跑 unit test 全綠 + coverage 100%

## 5. Middleware 變更（companion gate + poi-search whitelist + companion 白名單 rename）

- [ ] 5.1 寫 `tests/api/middleware-companion-gate.test.ts` 紅燈：(a) 三條件全符合 → companion mapping 啟用 (b) 缺 scope → fail (c) 缺 clientId → fail (d) 缺 header → fail
- [ ] 5.2 寫 `tests/api/middleware-poi-search-public.test.ts` 紅燈：anonymous GET `/api/poi-search?q=...` → 200（不拋 401）；anonymous POST /api/poi-search → 401
- [ ] 5.3 寫 `tests/api/middleware-companion-whitelist-poi-favorites.test.ts` 紅燈：companion scope + GET/POST/DELETE 對 `/api/poi-favorites*` 白名單 4 條 path 全 200；非白名單 path → 403
- [ ] 5.4 修改 `functions/api/_middleware.ts`：companion 白名單從 `/api/saved-pois` 改 `/api/poi-favorites`（4 條 pattern）
- [ ] 5.5 加入 `if (request.method === 'GET' && url.pathname === '/api/poi-search') { auth = null; return next(); }` public-read whitelist
- [ ] 5.6 在 V2 Bearer 認證後加 companion gate 升級邏輯：檢查 `auth.scopes.includes('companion') && auth.clientId === env.TP_REQUEST_CLIENT_ID && header X-Request-Scope === 'companion'`，缺一不啟用 companion
- [ ] 5.7 加 `env.TP_REQUEST_CLIENT_ID` 到 `Env` type definition + 文件註解
- [ ] 5.8 跑 middleware integration test 全綠

## 6. POST /api/poi-favorites handler（含 companion 分支）

- [ ] 6.1 寫 `tests/api/poi-favorites-post.integration.test.ts` 紅燈：V2 user 成功 201 + RETURNING row、poiId 缺/0/負數 → 400、POI 不存在 → 404、重複收藏 → 409、rate limit 11 次 → 429、admin bypass rate limit
- [ ] 6.2 同檔案 companion case：valid companion 三 gate 全過 + companionRequestId → 201 + audit_log changedBy='companion:<id>' + companion_request_actions 1 row
- [ ] 6.3 companion 同 requestId POST 第 2 次（不同 poiId）→ 409 `COMPANION_QUOTA_EXCEEDED`（D4 防護）
- [ ] 6.4 companion 越權 case：service token A 嘗試用 user B 的 requestId → fail-closed 401
- [ ] 6.5 SQL injection on note：note='x\'; DROP TABLE pois; --' → INSERT 成功（D1 prepared statement 防護）+ pois table 不被 drop
- [ ] 6.6 UTF-8 garbled note → middleware 擋 400 `DATA_ENCODING`（既有 _validate）
- [ ] 6.7 100 burst concurrent companion POST → companion bucket 滿時 429（D16）
- [ ] 6.8 self-reported `X-Request-Scope: companion` without OAuth scope → 走 V2 user 路徑（auth.userId null）→ 401（D2）
- [ ] 6.9 git mv `functions/api/saved-pois.ts` → `functions/api/poi-favorites.ts`
- [ ] 6.10 修改 POST handler：auth = `requireFavoriteActor(context, body, 'favorite_create')`，回 effective userId；INSERT 用 effectiveUserId；rate limit bucket 用 user vs companion 分離
- [ ] 6.11 companion 模式寫 audit_log（changedBy='companion:<id>', tripId='system:companion'）
- [ ] 6.12 跑 integration test 全綠

## 7. GET /api/poi-favorites handler

- [ ] 7.1 寫 `tests/api/poi-favorites-get.integration.test.ts` 紅燈：V2 user 200 + 含 usages 陣列、anonymous 200 + 空陣列、跨 user data leak 防護（A 不能看到 B 的私 trip 中收藏）
- [ ] 7.2 companion case：query param `?companionRequestId=N` 三 gate 全過 → 回該 submitter 的 favorites pool
- [ ] 7.3 修改 GET handler：`requireFavoriteActor(context, body=null, 'favorite_list')`（GET 從 query param 取 requestId）
- [ ] 7.4 查詢 SQL 不變（既有 json_group_array + EXISTS subquery 防 cross-user leak）
- [ ] 7.5 跑 integration test 全綠

## 8. DELETE /api/poi-favorites/:id handler

- [ ] 8.1 寫 `tests/api/poi-favorites-delete.integration.test.ts` 紅燈：owner 成功 204、非 owner → 403、不存在 → 404
- [ ] 8.2 companion case：companionRequestId 對應 submitter == row.user_id → 204 + audit + companion_request_actions 寫一筆 (id, 'favorite_delete')
- [ ] 8.3 companion 越權刪別 user 收藏 → fail-closed 401
- [ ] 8.4 git mv `functions/api/saved-pois/[id].ts` → `functions/api/poi-favorites/[id].ts`
- [ ] 8.5 修改 DELETE handler：用 requireFavoriteActor + ownership check（resolved userId === row.user_id OR isAdmin）
- [ ] 8.6 跑 integration test 全綠

## 9. POST /api/poi-favorites/:id/add-to-trip handler（4-field 純時間驅動）

- [ ] 9.1 寫 `tests/api/poi-favorites-add-to-trip.integration.test.ts` 紅燈：body schema 改 `{ tripId, dayNum, startTime, endTime }` 4 fields
- [ ] 9.2 紅燈 case：startTime/endTime 缺失 → 400 DATA_VALIDATION
- [ ] 9.3 紅燈 case：body 含 legacy position 或 anchorEntryId → 400「欄位已廢除」明確錯誤訊息
- [ ] 9.4 紅燈 case：startTime '12:00' 加進已有 11:00-12:00 entry 的 day → server 自動排到該 entry 之後（sort_order 計算正確）
- [ ] 9.5 紅燈 case：startTime '13:00' 加進已有 12:00-14:00 entry 的 day → 409 CONFLICT + conflictWith 結構
- [ ] 9.6 紅燈 case：valid V2 user 成功 201 + entry + trip_pois 各 1 row
- [ ] 9.7 紅燈 companion case：valid 三 gate + companionRequestId + ownership match → 201 + audit_log 寫 companion sentinel
- [ ] 9.8 git mv `functions/api/saved-pois/[id]/add-to-trip.ts` → `functions/api/poi-favorites/[id]/add-to-trip.ts`
- [ ] 9.9 修改 handler body schema：`{ tripId, dayNum, startTime, endTime }`，移除 position / anchorEntryId 處理邏輯
- [ ] 9.10 加 sort_order 計算：SELECT day 中所有 entries ORDER BY time → 找 startTime 之前最後一個 entry → 計算插入 sort_order
- [ ] 9.11 用 requireFavoriteActor helper，ownership 用 resolved userId 比對 saved.user_id
- [ ] 9.12 conflict 邏輯保留（newStart < entryEnd AND newEnd > entryStart → 409）
- [ ] 9.13 跑 integration test 全綠

## 10. Frontend rename + route + nav config

- [ ] 10.1 寫 `tests/unit/main-route-favorites.test.tsx` 紅燈：navigate `/favorites` → render PoiFavoritesPage、`/favorites/:id/add-to-trip` → render AddPoiFavoriteToTripPage、舊 `/saved` → 404（不留 redirect）
- [ ] 10.2 寫 `tests/unit/sidebar-favorites-label.test.tsx` 紅燈：DesktopSidebar 第 4 slot label='收藏'、key='favorites'、href='/favorites'
- [ ] 10.3 寫 `tests/unit/bottom-nav-favorites-label.test.tsx` 紅燈：GlobalBottomNav 第 4 tab label='收藏'、key='favorites'、href='/favorites'
- [ ] 10.4 git mv `src/pages/SavedPoisPage.tsx` → `src/pages/PoiFavoritesPage.tsx`
- [ ] 10.5 git mv `src/pages/AddSavedPoiToTripPage.tsx` → `src/pages/AddPoiFavoriteToTripPage.tsx`
- [ ] 10.6 修改 `src/entries/main.tsx`：lazy import rename + Route path rename + 移除 backward-compat（不留 `<Navigate>` redirect）
- [ ] 10.7 修改 `src/components/shell/DesktopSidebar.tsx` + `GlobalBottomNav.tsx`：key/label/href/matchPrefixes/activePatterns 全 rename，移除 `/^\/saved\b/` activePatterns
- [ ] 10.8 修改 `src/types/api.ts`：`SavedPoi` → `PoiFavorite`、`SavedPoiUsage` → `PoiFavoriteUsage`，cross-file import 全 rename
- [ ] 10.9 修改 `src/pages/PoiFavoritesPage.tsx` 內部變數：savedPois → poiFavorites、savedKeySet → favoriteKeySet、isSaved → isPoiFavorited、fetch URL → /api/poi-favorites
- [ ] 10.10 修改 `src/pages/AddPoiFavoriteToTripPage.tsx`：fetch URL + 變數命名同 above
- [ ] 10.11 修改 `src/pages/ExplorePage.tsx`：savedKeySet → favoriteKeySet、heart toggle fetch URL → /api/poi-favorites、按鈕 label「儲存到收藏」→「加入收藏」
- [ ] 10.12 修改 `src/pages/AddStopPage.tsx`：tab key 'saved' → 'favorites'、savedPois → poiFavorites、fetch /api/poi-favorites
- [ ] 10.13 修改 `src/pages/LoginPage.tsx:546`：「我的收藏跟著你」→「收藏跟著你」
- [ ] 10.14 修改 `src/pages/EditTripPage.tsx` + `NewTripPage.tsx`：usePoiSearch 用法不變但 verify 命名不污染
- [ ] 10.15 修改 `src/components/shared/ConflictModal.tsx`：grep 替換 saved 命名
- [ ] 10.16 verify SW config `vite.config.ts`：skipWaiting + clientsClaim 已啟（參考 D18）
- [ ] 10.17 跑 `git grep -nE "saved[-_]?pois|SavedPoi|savedPois|isSaved\b|/saved\b|saved-error|saved-count" -- src/ tests/` 確認 0 matches（archive 例外）
- [ ] 10.18 跑 unit test 全綠

## 11. PoiFavoritesPage redesign（mockup-driven hard gate）

- [ ] 11.1 invoke `/tp-claude-design` 產 PoiFavoritesPage HTML mockup 至 `docs/design-sessions/2026-05-04-favorites-redesign.html`，含：tp-page-eyebrow / tp-skel / tp-empty-cta tokens、`<PageErrorState>` shared component、region pill row + type filter row + search input、batch flow（delete-only sticky bottom toolbar）、8-state matrix、a11y（role=group + aria-pressed）、3 個 viewport（desktop 3-col / tablet 2-col / phone 1-col）
- [ ] 11.2 user review mockup → iterate 直到 user sign-off（hard gate）
- [ ] 11.3 寫 `tests/unit/poi-favorites-page-hierarchy.test.tsx` 紅燈：0 favorites 隱藏 filters、50 grid 為主、200+ sticky search + pagination
- [ ] 11.4 寫 `tests/unit/poi-favorites-page-states.test.tsx` 紅燈：8-state matrix 完整 cover（loading / empty-pool / filter-no-results / error / data / optimistic-delete / bulk-action-busy / pagination）
- [ ] 11.5 寫 `tests/unit/poi-favorites-page-a11y.test.tsx` 紅燈：role="group"（不是 tablist）、aria-pressed、aria-label per checkbox、aria-live 在 optimistic-delete
- [ ] 11.6 寫 `tests/unit/poi-favorites-page-batch.test.tsx` 紅燈：bulk select toolbar 只支援「全選 / 取消 / 刪除」，不支援 add-to-trip；per-card link 永遠是 add-to-trip 入口
- [ ] 11.7 寫 `tests/unit/poi-favorites-page-region-pill.test.tsx` 紅燈：region pill row 渲染 + 篩選邏輯（reuse ExplorePage L470-885）
- [ ] 11.8 寫 `tests/e2e/favorites-batch-delete.spec.js` 紅燈：login → /favorites → multi-select 2 cards → 點刪除 → confirm modal → 2 rows 移除 + toast
- [ ] 11.9 重構 PoiFavoritesPage.tsx 對齊 mockup：移除 inline `<style>` 改 `css/pages/poi-favorites.css`、token drift 6 項對齊、加 region pill + 8-state、a11y 修正、batch flow delete-only
- [ ] 11.10 跑 unit + e2e test 全綠

## 12. AddPoiFavoriteToTripPage 對齊 mockup（4-field 純時間驅動）

- [x] 12.1 ~~mockup~~ 已產出 docs/design-sessions/2026-05-04-favorites-redesign.html v4 含 4 frames（B1 desktop 2-col / B2 phone stack / B3 day skeleton / B4 conflict modal / B5 7-state mini）
- [x] 12.2 ~~user review~~ 已 sign-off（2026-05-04）
- [ ] 12.3 寫 `tests/unit/add-poi-favorite-form-fields.test.tsx` 紅燈：4 fields 渲染（trip / day / startTime / endTime）、SHALL NOT 含 position radio / anchorEntryId field、stay-duration heuristic 預填
- [ ] 12.4 寫 `tests/unit/add-poi-favorite-trip-day-skeleton.test.tsx` 紅燈：trip 切換時 day field 顯示 tp-skel skeleton + 提交按鈕 disabled
- [ ] 12.5 寫 `tests/unit/add-poi-favorite-titlebar.test.tsx` 紅燈：TitleBar title 靠左（flex:1）、左側返回 button、右側無 confirm action
- [ ] 12.6 寫 `tests/unit/add-poi-favorite-form-actions.test.tsx` 紅燈：「加入行程」primary button 在 `.tp-form-actions` wrapper 內、置中對齊、放在 4 fields 下方
- [ ] 12.7 寫 `tests/unit/add-poi-favorite-responsive.test.tsx` 紅燈：viewport ≥1024 用 2-col grid（max-width 720px）；viewport ≤760 stack 單欄 + button full-width
- [ ] 12.8 寫 `tests/unit/add-poi-favorite-states.test.tsx` 紅燈：7-state matrix（loading / empty-no-trip / conflict / error / success / optimistic / partial）
- [ ] 12.9 重構 `src/pages/AddPoiFavoriteToTripPage.tsx` 對齊 mockup B1/B2/B3：移除既有 position radio + anchorEntryId、加 `.tp-form-grid-2col` desktop layout、加 `.tp-form-actions` 置中 primary button、TitleBar 不放 confirm action
- [ ] 12.10 useAddToTrip hook（如有）API call body 改 `{ tripId, dayNum, startTime, endTime }` 4 fields
- [ ] 12.11 跑 unit test 全綠

## 13. CSS class rename + shared component 抽取

- [ ] 13.1 寫 `tests/unit/page-error-state.test.tsx` 紅燈：抽取 `<PageErrorState>` shared component（reuse 既有 pattern 或新 component）
- [ ] 13.2 寫 `tests/unit/empty-state.test.tsx` 紅燈：抽取 `<EmptyState>` shared component
- [ ] 13.3 grep `.saved-*` CSS class 全 rename 為 `.favorites-*`：`.saved-error-title` → `.favorites-error-title`、`.saved-count-meta` → `.favorites-count-meta` 等
- [ ] 13.4 抽 `<PageErrorState>` 與 `<EmptyState>` 至 `src/components/shared/`
- [ ] 13.5 PoiFavoritesPage 使用 shared component 取代自寫 `.saved-error` / `.saved-empty-cta`
- [ ] 13.6 抽 `tp-action-btn` family（取代 `.saved-toolbar-btn` 系列）至 `css/components/action-button.css` 或對應 token 檔
- [ ] 13.7 跑 grep `.saved-` 確認 src/ 與 css/ 全清空
- [ ] 13.8 跑 unit test 全綠

## 14. 跨 tp-* skill auth header rename（DX-F3.2 critical）

- [ ] 14.1 grep `.claude/skills/tp-*/` 與 `.codex/skills/tp-*/` 找出所有 `CF-Access-Client-Id` 與 `CF_ACCESS_CLIENT_ID` 出現處（tp-edit / tp-create / tp-rebuild / tp-patch / tp-shared / tp-search-strategies / tp-quality-rules / tp-check / tp-daily-check / tp-request 等）
- [ ] 14.2 逐一 rename 為 `Authorization: Bearer $TRIPLINE_API_TOKEN`（含 V2 OAuth client_credentials grant 取得方式說明）
- [ ] 14.3 修改 `.claude/skills/tp-shared/references.md` 主檔的 API 認證段落（L7-25 範圍）
- [ ] 14.4 修改 curl 模板：移除 `-H "CF-Access-Client-Id: ..."` 與 `-H "CF-Access-Client-Secret: ..."`，加入 `-H "Authorization: Bearer $TRIPLINE_API_TOKEN"`
- [ ] 14.5 同步更新 `.codex/skills/tp-shared/` 與 `.codex/skills/tp-request/` 鏡像
- [ ] 14.6 grep 確認 `.claude/skills/tp-*/` 與 `.codex/skills/tp-*/` 範圍 0 matches `CF-Access-Client-Id` / `CF_ACCESS_CLIENT_ID`

## 15. tp-request SKILL.md 加「加入收藏」flow（DX-F6.1 critical）

- [ ] 15.1 修改 `.claude/skills/tp-request/SKILL.md` 加 H3 段「3d.j 加入收藏 sub-flow」（top-level discoverability）
- [ ] 15.2 段落內容含：判斷規則（message 含「加入收藏」「收藏 X」「儲存到收藏」+ 具體 POI 名）+ 5 步流程：(1) Google Maps 驗證 (2) GET /api/pois?name=X 取 poiId (3) POST /api/poi-favorites with body.companionRequestId + body.poiId + Bearer + X-Request-Scope: companion (4) 處理回應（201/409/404/401）(5) PATCH /api/requests/:id status=completed
- [ ] 15.3 加 401 debug 3-step checklist：(a) curl /api/oauth/introspect 確認 token (b) D1 SELECT id, status, submitted_by FROM trip_requests WHERE id=? (c) D1 SELECT id FROM users WHERE LOWER(email)=LOWER(?)
- [ ] 15.4 修改 `.claude/skills/tp-request/SKILL.md` 第 75 行白名單：「saved-pois 4 條 path」→「poi-favorites 4 條 path」
- [ ] 15.5 修改 `.claude/skills/tp-request/references/security.md`：saved-pois 4 條 path → poi-favorites 4 條 path（L13-19）+ companion 邊界註記「已由 _companion.ts requireFavoriteActor 實作」（L21）+ 加 companion 寫入 audit_log 規範
- [ ] 15.6 同步更新 `.codex/skills/tp-request/SKILL.md` 與 `.codex/skills/tp-request/references/security.md` 鏡像
- [ ] 15.7 verify 30 秒 skim SKILL.md 主檔可掃到「加入收藏」能力（不在 references 內藏）

## 16. Mockup-first systematic gate（UC3 + DX-F4 systematic）

- [ ] 16.1 修改 `.claude/skills/tp-team/SKILL.md` Build phase 加新 sub-section「Mockup-first hard gate」：所有新 page 或新 component（≥1 layout 變化）SHALL 先 invoke `/tp-claude-design` 產 HTML mockup → user sign-off → 才寫 React。Bug fix / token drift fix / 純 prop tweak 例外
- [ ] 16.2 修改根目錄 `CLAUDE.md` Pipeline 段落加一行：「mockup-first hard gate（new page/component → /tp-claude-design → user sign-off → React）」
- [ ] 16.3 修改 `CLAUDE.md` 加「Naming history」section：紀錄 saved_pois → poi_favorites rename（migration 0050, v2.22.0）
- [ ] 16.4 修改 `DESIGN.md` 加「Naming history」section 同上
- [ ] 16.5 修改 `ARCHITECTURE.md` 加「Naming history」section 同上

## 17. DESIGN.md 廢除 asymmetric labels + favorites rename

- [ ] 17.1 修改 `DESIGN.md` L298 廢除 asymmetric labels 段落：刪除「DesktopSidebar label 用『我的收藏』...asymmetric labels intentional」描述，改為「DesktopSidebar 與 GlobalBottomNav 第 4 slot label 統一『收藏』，ownership 語意由 PoiFavoritesPage hero eyebrow 補回」
- [ ] 17.2 修改 `DESIGN.md` L259 TitleBar 文字「我的收藏」→「收藏」
- [ ] 17.3 修改 `DESIGN.md` L317 路由表 `/saved`、`/saved-pois/:id/add-to-trip` → `/favorites`、`/favorites/:id/add-to-trip`
- [ ] 17.4 修改 `DESIGN.md` L484 SavedPoisPage 收藏批次刪除 → PoiFavoritesPage
- [ ] 17.5 修改 `DESIGN.md` L565-657 整段「saved_pois universal pool」rename 為「poi_favorites universal pool」+ table/api/route 全 rename
- [ ] 17.6 補進 batch flow delete-only 規範（取代既有「per-card 加入行程 →」與多選 toolbar 並存的描述）
- [ ] 17.7 補進 PoiFavoritesPage 8-state matrix（取代原 5-state）
- [ ] 17.8 補進 viewport breakpoints 規範（1024+ 3-col / 640-1023 2-col / <430 1-col）
- [ ] 17.9 補進 a11y 規範（role="group" + aria-pressed + aria-label per row + aria-live）

## 18. .dev.vars.example + 其他 doc

- [ ] 18.1 修改 `.dev.vars.example` 加 `# TRIPLINE_API_TOKEN=local-dev-stub-token` + 註解說明 `/api/oauth/token` client_credentials grant 取得方式
- [ ] 18.2 修改 `.dev.vars.example` 加 `# TP_REQUEST_CLIENT_ID=local-dev-mac-mini-cron` env binding
- [ ] 18.3 修改 archive `openspec/changes/archive/2026-04-25-layout-overlay-rules-and-schema/specs/saved-pois-schema/` README 頂端加 banner：`> ⚠️ Renamed to poi_favorites in migration 0050 — see openspec/changes/poi-favorites-rename/`
- [ ] 18.4 修改 `CHANGELOG.md` 加 v2.22.0 entry（由 /ship 自動處理）
- [ ] 18.5 verify `vitest.setup.ts` + `tests/fixtures/` grep `saved_pois` literal 同步 rename

## 19. mac mini cron sync（pre-merge gate）

- [ ] 19.1 SSH mac mini → 修改 `scripts/tp-request-scheduler.sh` 將 base URL `/api/saved-pois` 改 `/api/poi-favorites`（含 4 條 endpoint）
- [ ] 19.2 mint 新 client_credentials token 含 `admin + companion` scope，更新 cron env var
- [ ] 19.3 在 mac mini 跑 dry-run smoke：trigger 測試 trip_requests row → assert tp-request 處理成功 + companion path 200
- [ ] 19.4 紀錄 mac mini 修改證據到 PR description（commit hash / config diff / dry-run output）
- [ ] 19.5 PR pre-merge gate：reviewer verify 此 task 完成（PR description 必含上述證據）

## 20. Pre-merge verification（含 lint / test / security）

- [ ] 20.1 `npm run lint` 全綠
- [ ] 20.2 `npm run test` (unit) 全綠
- [ ] 20.3 `npm run test:api` (integration) 全綠
- [ ] 20.4 `npm run test:e2e` 全綠（含 favorites-batch-delete.spec.js）
- [ ] 20.5 `npm run build` 成功
- [ ] 20.6 `npm run verify-sw` 成功（service worker 配置正確）
- [ ] 20.7 invoke `/tp-code-verify` — 命名規範、React Best Practices、CSS HIG、測試狀態全綠
- [ ] 20.8 invoke `/review` — staff engineer diff 審查（SQL safety、race condition、specialist dispatch、adversarial）
- [ ] 20.9 invoke `/cso --diff` — diff-scoped 安全掃描（secrets / injection / OWASP / STRIDE）
- [ ] 20.10 invoke `/qa` — 瀏覽器 QA 測試 + bug fix
- [ ] 20.11 verify task #11 spec 變更 37 項已全 cover 在 OpenSpec change（archive 後此 task 改為 verify openspec/changes/poi-favorites-rename/ 對齊）

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
