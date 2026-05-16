# Tripline

Cloudflare Pages + D1 + React SPA + V2 OAuth. Admin: lean.lean@gmail.com.

## Pipeline

`Think → Plan → Build → Review → Test → Ship → Reflect`

- Think `/office-hours` · Plan `/autoplan` · Build code + `/simplify`
- Review `/tp-code-verify` + `/review` (mandatory)
- Test `/cso --diff` (mandatory) + `/qa`
- Ship `/ship` → `/land-and-deploy` → `/canary` · Reflect `/retro`

## Hard Rules

- **Code change → invoke `/tp-team` first** (新功能、bug fix、refactor、migration、CSS、API endpoint)。行程資料用 `tp-*` data skills 直接打 API。
- **Mockup-first hard gate**：所有 new page / new component（≥1 layout 變化）→ `/tp-claude-design` 產 HTML mockup → user sign-off → 才寫 React。Bug fix / token drift / 純 prop tweak 例外。
- Feature branch + PR via `/ship`. Never push master directly.
- `tp-*` skills hit API, not local files.
- Agent tool only for worktree isolation.
- Web browse: `/browse` only, never `mcp__claude-in-chrome__*`.
- Post-ship retroactive OpenSpec archive if PR didn't propose first.

## Layout

`src/` SPA · `functions/api/` Pages Functions · `migrations/` D1 · `tests/` · `css/tokens.css` Tailwind 4.

Desktop ≥1024px: 2-col timeline + sticky map. Mobile: 5-tab nav.

## Dev

```bash
npm run dev:init   # local SQLite
npm run dev        # vite 5173 + wrangler 8788
```

Mock auth: copy `.dev.vars.example` → `.dev.vars` (NOT `.env.local`), set `DEV_MOCK_EMAIL`.
Prod `TRIPLINE_API_URL`: funnel listens `:443`, not `:8443`.

## Design SoT

`DESIGN.md` + `docs/design-sessions/terracotta-preview-v2.html` are UI/UX truth. Code mismatch = bug. Conflict → discuss first.

## Skill Routing

Match → invoke `Skill` first.

- Brainstorm → `/office-hours` · Bug → `/investigate`
- Ship/PR → `/ship` · QA → `/qa` · Code review → `/review`
- Doc sync post-ship → `/document-release`
- Visual → `/design-review` · Architecture → `/plan-eng-review`
- Browse → `/browse`

Detail: `ARCHITECTURE.md`, `GEMINI.md`, `DESIGN.md`, `.claude/skills/tp-team/SKILL.md`.
Prod: https://trip-planner-dby.pages.dev/ · GBrain: pglite + MCP (user scope), sync=full, repo=read-write, 873 pages, setup 2026-05-04. Windows caveat: transcript ingest no-op (script POSIX-only). See `~/.gbrain/config.json`.

## Naming history

- **v2.31.12**: ExplorePage POI 卡片 rating 寫死 placeholder「探索更多評論」，comment 寫「真實 rating 待 backend 提供」是 v2.23.0 google-maps-migration 前的 stale comment。Backend 早就回 `PoiSearchResult.rating: 4.6`，UI fix 為 `{typeof poi.rating === 'number' ? poi.rating.toFixed(1) : '探索更多評論'}`。Fallback 仍保留 placeholder 字串（無 rating data 時）。
- **v2.31.11**: ChangePoiPage 同樣 3 個 search rating + section title + favorites star bug — copy-paste from AddStopPage 修法。Section title `query.trim().length >= 2 ? '搜尋結果' : '熱門景點'`，search card 條件 render `★ {rating.toFixed(1)} · address`（ChangePoiPage `normalizeSearchResults` 用 cast，rating 已含），favorites card 暫拔孤兒 star（待 task #114 backend SELECT 補）。3 個 regression test。
- **v2.31.10**: add-stop page 三個 prod QA 小 bug — (1) section title 寫死「熱門景點 · {region}」搜尋態語意不對，改成 `query.trim().length >= 2 ? '搜尋結果' : '熱門景點'`；(2) search card star icon 沒值（backend 有回 `rating: 4.6` 但 `normalizeSearchResults` 沒抽），補 `typeof item.rating === 'number'` extract + card meta 條件 render `★ {rating.toFixed(1)} · address`；(3) favorites card 同樣孤兒 star（poi-favorites API SELECT 沒拿 rating，schema 有 pois.rating），先拔 star avoid 誤導，#114 follow-up backend SELECT 補。
- **v2.31.9**: `useTripSegments` N+1 fix — 5-day trip 詳細頁原本平行 5 個 `GET /api/trips/:id/segments`（每個 `TimelineRail` 自己 call hook）。新 `TripSegmentsContext` provider 在 `TripPage` 一次 fetch，children TimelineRail 透過 context 共用 `segmentMap`。Hook 內部 `useContext(TripSegmentsContext)` 偵測 provider 存在 → 直接 return context 值；缺席（EditEntryPage 等獨立頁面）→ 退回原本 fetch path。3 個 regression test：context 存在不 fetch、多 hook caller 共用、context 缺席仍正常 fetch。
- **v2.31.8**: 兩個 v2.31.7 prod QA 補丁 — (1) TravelPill 初始 render 閃顯反向方向：v2.29.0 backend rewrite 後 `entry.travel = segmentsMap.get(from_entry_id=eid)` 語意是「離開此 entry」，但 UI pill 位於 (prev → curr) 中間應讀「離開 prev = 抵達 curr」=`prev.travel`。`TimelineRail.tsx` fallback 從 `entry.travel` 改 `prev?.travel`，segments 載入後 segment prop 接手覆蓋仍正確；更新 `timeline-rail-segments-wiring.test.tsx` 既有 fallback test 對齊 backend semantic（travel 改掛 prev = entry 1）+ 新增 regression test 確認 travel on curr 不誤觸發 fallback。(2) AI 健檢「30 秒內完成」誤導：實測 request #190 跑 3m46s、#196 跑 9 分鐘、#187 worst case 1h19m；empty / pending state 文案改「3-7 分鐘完成」。
- **v2.31.7**: D1 naive datetime UTC parse 修正 — D1 `datetime('now')` 回 `YYYY-MM-DD HH:MM:SS` 無 Z 後綴，前端 `new Date(s)` 當 local time → 顯示落差 TZ offset 小時（AI 健檢「8 小時前完成」實際 7 分鐘）。新 helper `src/lib/parseUtcDate.ts` 偵測 D1 naive datetime 補 Z 後 UTC parse。修 4 個 callsite：TripHealthCheckPage formatTimestamp、ChatPage formatChatTime+formatDayDivider+buildMessagesWithDividers、SessionsPage relativeTime、DeveloperAppsPage created_at。
- **v2.31.6**: Chat polling robust 化 — 解 SSE 逾時 silent 卡死。Server `MAX_DURATION_MS` 10 min → 30 min（request #187 曾跑 1h19m）；client `useRequestSSE` 重寫 — polling 永遠跑（safety-net 30s interval），SSE 退位成 latency optimization。原本 EventSource auto-reconnect 不一定觸 `onerror`，clean-close 後 polling fallback 永遠沒啟動。新增 `errorReason='auth_expired'`（401 polling → 登入過期提示）+ `elapsedMs` UI 顯示「AI 還在處理（已等候 N 分鐘）」避免 spinner-only 看似卡死。
- **v2.31.4**: 拔掉 `/tp-poi-enrich-monthly` schedule — batch 腳本 `scripts/poi-enrich-batch.ts` 在 v2.23.0 (commit `ac23d4e`) Google Maps Platform 切換時已刪，POI enrichment 改成「新 POI 即時 `POST /api/pois/:id/enrich`」+「30 天 daily refresh `scripts/google-poi-refresh-30d.ts` 50/day cap」，monthly batch 失去意義。移除 api-server 內 `scheduleDaily(8, 0, '/tp-poi-enrich-monthly', 'poi-enrich')` + `.claude/skills/tp-poi-enrich-monthly/` + `.codex/skills/tp-poi-enrich-monthly/`。剩 2 schedules：request-handler 每 30 min + daily-check 每天 09:00。
- **v2.31.3**: api-server 內建多排程 cron 取代 launchd / Cowork — v2.30.5 Cowork 路徑因 backend API 化 + JSON 重啟清空失效（2026-05-07 起 cron 全停 11 天），v2.30.18 single-cron band-aid 升級為 3 schedules 主路徑：`/tp-request` 每 30 min（兜底，CF Pages POST 即時 trigger 第一線）+ `/tp-daily-check` 每天 09:00 + `/tp-poi-enrich-monthly` 每天 08:00（skill 內 day-1 guard）。新增 `scripts/lib/schedule-daily.ts::computeNextDailyFire`（pure helper，3 case unit test）+ tp-daily-check / tp-poi-enrich-monthly skill Self-destruct section（tmux session orphan 避免）+ tp-request skill empty-queue path 也跳到 self-destruct（之前 30min orphan 阻擋下一輪 cron）。`spawnTmuxRequest(skillCommand)` + `processLoop(source, skillCommand)` 支援多 skill spawn。Deploy 後驗證點：api-server log 出現 3 行 `Scheduled <label>`。
- **v2.31.1**: AI 健檢 Phase 2 — Claude prompt 強化（5 個 audit dimensions: timing/distance/meals/sights/hotel + JSON-only enforcement 加 example + 加 `dimension` 與 `suggestion` 欄位）+ findings 顯示 polish（dimension chip 顯示審查維度、suggestion block 顯示建議怎麼修、`action_target.entry_id` → 「前往景點」navigate `/trip/:id/stop/:eid/edit` 優先於 day-only 跳轉）。Backend `sanitizeFindings` 加 VALID_DIMENSIONS allowlist + suggestion 字數限制（200 字）。Frontend `Dimension` type + `DIMENSION_LABEL` map（時間/移動/餐飲/景點/住宿 中文 label）。
- **v2.31.0** (migration 0067): AI 健檢功能上線 — 新表 `trip_health_reports`（PRIMARY KEY trip_id，per-trip latest only）+ POST/GET `/api/trips/:id/health-check` + 全頁 route `/trip/:id/health`（`TripHealthCheckPage.tsx`）。觸發後同步 INSERT `trip_requests` with `[AI 健檢]` prefix（user 在 /chat 可看對話留底），api-server processLoop 跑 Claude → PATCH `/api/requests/:id` 完成 hook 看到 prefix → parse reply JSON findings → UPDATE `trip_health_reports`。Findings schema `{severity: high|medium|low, title, description, action_target?: {day, entry_id}}`。Frontend polling 3s 直到 completed/failed。4 state（empty/pending/completed/failed）+ re-generating overlay（pending + 舊 findings → 「再重新生成」disabled）。命名注意：避開 v2.23.0 既有 `<TripHealthBanner>`（POI lifecycle health），新 component CSS prefix `tp-ai-health-*` / testid `ai-health-*`。兩處入口：TripCardMenu（列表卡片 ⋯）+ EmbeddedActionMenu（行程詳細頁 ⋯）。Severity 色用既有 `--color-priority-{high,medium,low}-{bg,dot}` token，不用 terracotta（accent 保留給 chrome / CTA）。
- **v2.30.0** (migration 0064): `trip_segments.mode_source` DROPPED — 移除「上鎖」概念。PATCH /segments/:sid 新 contract：`mode='transit'` 必填 min（source='manual'，不打 Routes），`mode='driving'`/`'walking'` 一律 Google Routes 重算（ignore body.min, source='google'）；缺 coords / API key → 保留舊 min/distance + computed_at=NULL 標 stale。recompute-travel skip 條件 `mode_source='user'` → `mode='transit'`；response field `pairsSkippedUser` → `pairsSkippedTransit`。Frontend 拔 🔒 icon、`isLocked` 變數、TravelPillDialog 「已手動覆寫」title indicator、EditEntryPage「重設為自動」button。Deploy 順序：先 apply migration → 再 deploy backend（30-90s race window accept，同 v2.29.0 pattern）。
- **v2.29.x**: trip_pois 整表 + saved_pois DROPPED — v2.29.0 (migration 0061+0062): `trip_pois` rip-out（10 col cleanup，所有 alternates/master/hotel/shopping/restaurant 統一 trip_entry_pois + trip_days.hotel_poi_id + poi_relations 模型）；v2.29.1 (migration 0063): `DROP TABLE saved_pois`（poi-favorites-rename Phase 2，10 天 soak 後）；v2.29.2: stale-travel ⚠ 偵測改用 `segment.computed_at IS NULL` signal（拔 Haversine vs distance divergence 邏輯）；v2.29.3: daily-check `queryRequestErrors` 移除 stale SELECT `trip_requests.mode`。
- **v2.28.3**: Entry multi-POI UI parity — 編輯頁、置換頁、行程一覽統一使用 `trip_entry_pois.sort_order=1` 正選 / `sort_order>1` 備選模型。`POST /alternates` 支援搜尋結果 find-or-create（不必先收藏），`PUT /poi-id` 保留搜尋 POI 的 type/category/address/rating/country。TimelineRail expanded choices 改讀 `entry.stopPois`，用通用「景點選擇」卡片顯示正選 + 備選，餐廳與一般景點格式一致。
- **v2.28.0** (migration 0059 standalone script): Restaurants → alternates Phase 1 — `scripts/migrate-0059-restaurants-to-alternates.ts` 把 `trip_pois` context='timeline' rows backfill 進 `trip_entry_pois` 當 alternates (sort_order > 1)。Idempotent (UNIQUE entry_id, poi_id)、`--dry-run/--apply`、`--local/--remote`、bump `entry_pois_version`。同時 fix GET /api/trips/:id/entries/:eid SELECT 只回 4 欄的 bug (改 SELECT * → time/startTime/endTime/note/poiId 都 surface)。Backend `fetchEntryPoisByEntries` 多 LEFT JOIN `trip_pois` surface restaurant 欄位 (hours/rating/price/reservation/reservation_url/description/note) 到 alternates response。EditEntryPage alternates row 加 rating star + price/hours/reservation chips (reservationUrl 存在 → link)。剩餘 Phase 2：觀察 2 週後 DROP `restaurants` TABLE，並移除 `raw.restaurants → infoBoxes` legacy read path。Deploy 順序：merge → backend 上線 → 手動 `--dry-run --remote` → 確認後 `--apply --remote`。
- **v2.27.0** (migration 0057 + 0058): multi-POI per entry — `trip_entry_pois` junction table (entry × poi M:N) + `trip_entries.entry_pois_version` INTEGER OCC counter。每 entry 可掛 1 master (sort_order=1) + N alternates。6 個新 endpoints（PATCH /master / POST,DELETE /alternates / PATCH /alternates/reorder）含 OCC `entryPoisVersion` token，409 STALE_ENTRY 表示需 refetch。PUT /poi-id 加可選 OCC + 拒絕 null（master invariant）。EditEntryPage 加 alternates section + master swap + 加備案 + 重排（V1 compact + expandable）。Frontend selector fallback chain (`getEntryMaster` / `getEntryMasterPoiId`) 處理 Phase 1 dual-read 過渡。Phase 2 (v2.27.x) 待 DROP `trip_entries.poi_id`。Deploy 順序：apply migration 0057 + 0058 → wait 30s → merge PR；rollback 必須先 revert backend deploy 再 DROP COLUMN（current backend reads `entry_pois_version` exclusively）。
- **v2.26.0** (migration 0056): `trip_entries` ADD COLUMN `start_time` / `end_time` TEXT — 拆分自 free-form `time` col。Backfill 既有 `"HH:MM-HH:MM"` 拆兩欄、`"HH:MM"` → start_time only。**不 drop** legacy `time`（dual-write 觀察期）。Backend dual-write：PATCH /entries 接受新舊欄位互轉；POST /entries / PUT /days / copy / poi-favorites add-to-trip 均同步寫 start/end + legacy time。新增 `EditEntryPage` 全頁編輯（route `/trip/:id/stop/:eid/edit`）— 三 sections（時間 / 從上一站移動方式 / 備註）整合 `PATCH /entries`（time + note）+ `PATCH /segments`（mode + min）並行儲存；TimelineRail toolbar pencil 從 inline note edit 改 navigate（testid `timeline-rail-edit-note-N` → `timeline-rail-edit-N`，inline note edit via note-value click 仍保留）。
- **v2.25.5** (migration 0055): `trip_pois.hours` DROP COLUMN → hours 純 `pois` master。Backfill `trip_pois.hours` non-null → `pois.hours`（COALESCE，不覆蓋既有），ALTER TABLE DROP。Backend cutover：`_merge.ts` 直接讀 `poi.hours`（不再 dual-read）；`POI_MASTER_ONLY_FIELDS` 加 `'hours'`，`PATCH /trip-pois` 帶 hours 自動 dispatch 到 pois；POST /trip-pois + PUT /days hours 透過 `findOrCreatePoi` 寫 pois.hours。**tp-* skills 完全重寫**：第一原則改為「`POST /api/pois/{id}/enrich` 透過 backend 打 Place Details API」，移除 `/browse` Google Maps + WebSearch 拼湊路徑。Place Details `weekday_descriptions` 已含全週時段 + 公休日（「星期三: 休息」），不需另外處理定休日欄位。Deploy 順序：先 merge PR + deploy backend，再 apply migration（順序顛倒會讓既有 backend `INSERT trip_pois.hours` 觸發 SQL fail）。
- **v2.25.4** (migration 0054 phase 1): `trip_pois.price` → `pois.price`（餐廳定價是客觀屬性，不該按 trip 變動）。Phase 1 = ADD COLUMN pois.price + COPY existing trip_pois.price。Backend cutover：write 走 pois.price（findOrCreatePoi + PATCH /pois 接受），read dual（`pois.price ?? trip_pois.price`）。`POI_MASTER_ONLY_FIELDS` 加入 `'price'` → PATCH /trip-pois 帶 price 自動 dispatch 到 pois。Migration 0055 觀察期後 DROP `trip_pois.price`。

- **v2.23.0** (migration 0051): Google Maps Platform 全套切換（OSM Nominatim + Mapbox + ORS + Leaflet + Haversine 全部 ripped out，no fallback）。`pois.osm_id` (number) → `pois.place_id` (string Google ChIJ id) + 4 lifecycle cols (`status` active/closed/missing + `status_reason` + `status_checked_at` + `last_refreshed_at`)。新表 `pois_search_cache`（24h TTL）+ `app_settings`（kill switch state + 90/50 hysteresis thresholds）。`functions/api/poi-search.ts` Nominatim → Google Places Text Search；`route.ts` Mapbox → Google Routes API；`OceanMap.tsx` Leaflet → Google Maps JS API（300-500KB lazy-loaded with `<MapSkeleton>` placeholder）。新 admin endpoints `/api/admin/{maps-lock,maps-unlock,backfill-status,maps-settings,quota-estimate,pois-pending-place-id,pois-due-refresh}.ts`。新 `/api/trips/:id/health` 給 `<TripHealthBanner>`。新 React 元件 `<PoiStatusBadge>` / `<TripHealthBanner>` / `<MapSkeleton>`。3 個 mac mini cron scripts（`google-poi-initial-backfill` / `google-poi-refresh-30d` / `google-quota-monitor`）+ npm scripts `backfill:google` / `refresh:google` / `quota:google`。tp-* SKILL.md (11 個檔 × .claude + .codex = 22 syncs) 改用 Place Details API（canonical curl block 在 `tp-shared/references/poi-spec.md`）。Hard cutover, no aliases.

- **v2.22.0** (migration 0050): `saved_pois` table → `poi_favorites`; `/saved` route → `/favorites`; `/api/saved-pois` → `/api/poi-favorites`; `SavedPoisPage` → `PoiFavoritesPage`; `AddSavedPoiToTripPage` → `AddPoiFavoriteToTripPage`. Hard cutover, no aliases. CSS class `tp-saved-*` → `tp-favorites-*`. Cross-skill auth header CF-Access → `Authorization: Bearer $TRIPLINE_API_TOKEN`.
- **v2.21.3** (migration 0049): `trip_requests.mode` column DROPPED. tp-request skill auto-classifies intent.
- **v2.21.2** (migration 0048): `trip_requests.mode` 改 nullable + drop CHECK constraint (phase 1 of mode rip-out).
- **v2.21.0** (migration 0046+0047): `trip_ideas` → `saved_pois` universal pool; `trips.owner_email` → `owner_user_id`; `saved_pois.email` / `trip_permissions.email` DROPPED.
- **v2.20.0** (migration 0046 phase 1): `trip_ideas` table retired; `tp-request mode` rip-out 啟動.
- **v2.19.x** (migration 0045): `pois.google_rating` → `rating`; `pois.maps` DROPPED; `trips.{auto_scroll,og_description,footer,food_prefs,is_default,self_drive}` DROPPED.
