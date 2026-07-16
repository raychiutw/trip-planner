# TODOs

已知待辦與 follow-up。按 Skill/Component 分組，每項標 Priority。

**Priority**：
- **P0** — 現在就該修（阻擋使用 / 資料損失 / 安全性）
- **P1** — 下一個 sprint 要修（明顯影響使用者體驗）
- **P2** — 有空就修（少數人踩到、體驗小瑕疵）
- **P3** — 想做再做（nice-to-have）
- **P4** — 可能不做（長期觀察）

---

## Active

### tp-request — flag-OFF 路徑仍走未-contained spawn（activation 硬化）

**Priority**: P1（安全；pre-existing，flag OFF 才可達）

`TP_REQUEST_USER_TOKEN` OFF 時，`/tp-request`（處理 untrusted `trip_requests.message`）仍降級 service-token 走未-contained `--dangerously-skip-permissions` session（`spawnTmuxRequest` 未-contained tmux 路徑），prompt-injection 可讀 Mac 憑證 → 拿 `API_SECRET` 可 mint owner token（若該 owner 已有 Consent）。flag ON 時此路徑已不可達（走 mint→contained 或 fail-closed）。**不能盲修**：10-min cron + CF `/trigger` 都在此路徑跑 prod AI 聊天 pipeline，直接 `return false` 會停掉聊天。與 containment 就緒度耦合 → 併 activation 一起做：activation 應**原子化**（containment ready + Consent + flag 同時上），別留 Consent-first-flag-later 窗口；或改造 spawn 讓 service-token 路徑也能 contained。security-auditor v2.55.62 P1。

---

## Completed

### trip_segments — recompute 不清 stale 非相鄰段（reorder 後幽靈車程）

**Priority:** P2 · **Component:** recompute-travel / trip_segments
**Completed:** v2.55.43 (2026-07-09)

`recompute-travel.ts` 只 upsert 逐日相鄰對（ON CONFLICT），**從不 DELETE** 當前相鄰集以外的舊段。entry reorder 後同一 `from_entry_id` 會殘留舊 `from→to` 段（FK cascade 只在 entry **刪除**時清，reorder 不觸發）。影響：days API `fetchTripSegmentsMap` 每站任取一段（無 ORDER BY）→ timeline 可能顯示 reorder 前的舊車程。v2.55.39 先補 day-scoped stale prune；v2.55.43 補完整為 trip-wide prune：每次 recompute（含 `?day=N`、刪景點觸發、self-heal）都載入全 trip 現行相鄰 pair 白名單，刪除任何不在白名單的幽靈段；Routes compute 仍只跑 scoped day，subrequest 數不放大。integration regression 覆蓋同日 reorder、`day=1` 清 `day=2` orphan，以及非 scoped day 有效段不被誤清。

### Funnel-guard launchd 護衛（自動偵測 funnel :443 drift + auto-heal）

**Priority:** P1
**Completed:** v2.33.123 (2026-05-26)

Tailscale funnel 反覆被 macOS update / GUI app / 第三方 brew 改成 `serve` (tailnet only) → CF Worker public `/trigger` 全 530。已第 3 次（v2.33.111）+ 本 PR 開發中第 4 次發生（guard.sh 在實機自動修復）。

實際 shipped 方案（從原 5 step 收斂為 4 step）：
1. `scripts/funnel-guard/guard.sh` — jq parse `tailscale serve status --json`，drift 就 `serve reset` + `funnel --bg --https=443 http://127.0.0.1:8080` + Telegram alert（via 既有 `scripts/lib/send-telegram.sh`）+ state-transition alerting（避免 sustained drift Telegram flood）+ kill-switch `.disabled` file（incident response）
2. `scripts/com.tripline.funnel-guard.plist` — StartInterval=120, RunAtLoad=true
3. ~~`/etc/sudoers.d/tripline-funnel-guard`~~ — **drop**：`tailscale funnel` user perm 透過 tailscaled socket 即可，少一個攻擊面
4. `scripts/funnel-guard/install.sh` — idempotent symlink + bootout/bootstrap
5. ~~api-server `/internal/funnel-alert` endpoint~~ — **drop**：guard 直接打 Telegram 解耦（api-server crash 時 guard 仍能 alert）

### cleanupOrphans SESSION_PREFIX 過時 — orphan tmux session 永遠不清

**Priority**: P0
**Completed**: v2.33.111 (2026-05-25)

`scripts/tripline-api-server.ts:92` `SESSION_PREFIX = 'tripline-request-'`，v2.33.27 per-skill rename 後實際 session 命名是 `tripline-tp-request-*` / `tripline-tp-daily-check-*` → `cleanupOrphans` filter 永遠 false → orphan 完全不被清 → `hasActiveSession()` 永真 → cron 每次 skip → AI 健檢 request 209 卡 1h21m。

Fix：(1) cleanupOrphans 改 ALLOWED_SKILLS-derived prefix set + LEGACY_SESSION_PREFIX allowlist-driven 比對；(2) tmux ls format 從 space-delimited 改 `|`-delimited（防 session name 含空格的同病灶 race，adversarial review 點名）；(3) hasActiveSession 簽名改 required，刪 SESSION_PREFIX 死碼；(4) 9 條 regression test。

### Lighthouse — Blocking gate（v2.33.107）

**Priority**: P2
**Completed**: v2.33.107 (2026-05-25)

5 assertion 由 `warn` 改 `error` 設 blocking gate；閾值給 warn × 1.2 buffer（LCP 3000ms、TBT 400ms、CLS 0.15、performance 0.7、accessibility 0.85）避免首次 deploy 過度敏感 fail。後續觀察 GitHub Actions artifact 數據再 tighten 閾值。

---

### v2.30.13 — TravelPill mobile margin cascade fix (v2.30.12 未生效於 mobile)

**Priority:** P1
**Completed:** v2.30.13 (2026-05-16)

QA prod 用 login 跑 mobile viewport 發現 v2.30.12 layout 緊湊化在 mobile 上**沒生效**：computed margin-left 仍是 92px 而非預期 44px。

Root cause：`src/components/trip/TravelPill.tsx` SCOPED_STYLES 內兩個 `@media (max-width: 760px)` block 重複 `.tp-travel-pill-wrap` 規則，cascade 後者勝出 → 92px override 掉 44px。修：合併兩個 mobile @media block。

教訓：scoped inline `<style>` SCOPED_STYLES 多個 @media block 容易產生重複 selector race；應該每個 component 只放一個 mobile @media block。

### v2.30.12 — TimelineRail 緊湊版型 + recompute toast 精準化

**Priority:** P2
**Completed:** v2.30.12 (2026-05-16)

User 報兩個 issue：
1. 「車程未更新 重新計算無效」— 後端 0 段被算（POI 缺座標跳過），前端只 show 通用 toast 看起來沒反應。修：後端加 `pairsSkippedMissingCoords` counter，前端解析 response 給精準 toast（缺座標 / Google Routes 失敗 / 沒可重算 / 部分跳過 / 全 success 5 種分支）。
2. 「行程展開後也是空白 調整讓版面緊湊」— rail time col 多數 user 沒填仍佔 50px 桌面 / 44px mobile dead 寬度；expanded panel 與 TravelPill 對齊舊 dot 中心 indent 110/92px 過深。修：drop time col，dot/head 往左移 1 col；entry.time 有值改 inline `.ocean-rail-sub-time` chip；TravelPill / rail-detail indent 110→56 (mobile 92→44) px。

### v2.30.11 — DayHero stats block 移除（重複 heroSub）

**Priority:** P3
**Completed:** v2.30.11 (2026-05-15)

DaySection ocean-hero 卡片下方 `STOPS / Start / End` 3-col stats grid 與標題下 `heroSub`「N 個 stops · X km · 預估 Y 小時」資訊重複。刪 stats JSX block + 對應 4 個 CSS class family + mobile/desktop/print-mode override 3 條 + dead `.ocean-hero-summary` 順手清掉。

### v2.30.10 — `/account/appearance` 移除主題色 card grid

**Priority:** P3
**Completed:** v2.30.10 (2026-05-15)

User 指出 AppearanceSettingsPage 兩個 section 操控同一 `colorMode` state（淺/自動/深），功能重複。刪「主題色 / 選擇色票」card grid 保留「深淺模式」`<ThemeToggle>`。連帶清掉 dead code：`src/lib/appearance.ts` 整檔刪除、`.color-mode-*` CSS family + `--cmp-light/dark-*` 6 個變數從 tokens.css 拔掉、tokens-css.test 斷言改 not.toContain。

### v2.30.9 — `scripts/_archived/` 整個目錄刪除

**Priority:** P3
**Completed:** v2.30.9 (2026-05-15)

User 規則「不使用的就刪除」。v2.30.8 archive 3 支 stale script 不夠徹底 — 連既有 `scripts/_archived/` 5 支也都刪。8 支 one-shot migration / backfill script 一次清完。日後需要重現 migration pattern 從 git history 撈。

### v2.30.8 — Dropped-table 殘留清理

**Priority:** P2
**Completed:** v2.30.8 (2026-05-15)

User audit「檢查還有沒有使用到 drop table 的程式碼」。Active code 找到 1 個 bug + 3 支 stale script：

- `scripts/dump-d1.js` table list 含 dropped `trip_pois` + 漏 v2.22~v2.27 新表 7 種 → 修
- 3 支 stale one-shot script (`resolve-poi-collisions.js` / `backfill-user-id.js` / `verify-user-backfill.ts`) 引用 dropped `trip_pois` / `saved_pois` / `trip_ideas` → 搬 `scripts/_archived/`

其他 hit 全是 historical comment / migration test 字串斷言 / endpoint URL backward compat path（無 active SQL）。

### v2.30.7 — Revert v2.30.6 + ephemeral tmux session pattern 取代 `claude -p`

**Priority:** P1
**Completed:** v2.30.7 (2026-05-15)

v2.30.6 過度解讀「替換 claude -p」做了整段刪除（PR #546 砍掉 `runClaude` / `processLoop` / `POST /trigger`）。User 澄清「不是整個移除 只是移除-p參數」+ 規範 ephemeral tmux session pattern。本 PR：

1. `git revert 7d6b324` 還原 trigger/processLoop 結構
2. `runClaude` 改用 `spawnSync('tmux', ['new-session', '-d', ...])` 開 detached session 跑 `claude --dangerously-skip-permissions --name <session>`（無 `-p`），session 命名 `tripline-request-<timestamp>-<pid>`
3. Skill 內部 drain queue + PATCH status 完成後，SKILL.md 結尾 `tmux kill-session -t $TRIPLINE_TMUX_SESSION` 自殺
4. API server `cleanupOrphans()` 在每次 `/trigger` 開頭掃 `tripline-request-*` session，> 30 min 強取 kill（兜底）
5. `hasActiveSession()` 防止 concurrent /trigger 同時 spawn 兩個 claude race condition

**Why tmux**：隱藏執行 + 無 `-p` + race-free single concurrent + ephemeral 避免 context 累積 + 30min token TTL 內保證 orphan cleanup。

### v2.30.5 — Schedulers → Claude Cowork migration

**Priority:** P1
**Completed:** v2.30.5 (2026-05-15)

3 支 scheduler.sh + 對應 launchd plist 全部廢除，改由 Claude Desktop Cowork scheduled task 觸發 skill 內部跑流程：

- **daily-check** → Cowork Daily 跑 `/tp-daily-check`（含 in-session code fix pipeline，不再 spawn 新 `claude -p` process）
- **tp-request** → Cowork Hourly 跑 `/tp-request`（接受 hourly latency，從原 15 min 降級換取 keychain isolation 修復）
- **poi-enrich-monthly** → Cowork Daily fire + skill 內 `date +%d == 01` 檢查跑 `/tp-poi-enrich-monthly`（Cowork 無 monthly 頻率）

**動機**：2026-05-11 LaunchAgent → LaunchDaemon migration 引入 keychain isolation — LaunchDaemon `UserName=ray` 仍 pre-login session 拿不到 user keychain，導致 `claude -p` OAuth token unreachable，daily-check Phase 2 / tp-request 全部沉默失敗。Cowork 跑在 Claude Desktop 使用者 session 內，自然繼承 keychain + shell env，零 auth 設定。

抽公用 helper：`scripts/lib/send-telegram.sh`（3 支 scheduler 重複 Telegram wrapper 統一）+ `scripts/lib/build-daily-check-msg.js`（daily-check report → Telegram 訊息）。`scripts/lib/scheduler-common.sh` 已無 .sh 呼叫者，刪除。`daily-check.js` `querySchedulerErrors()` 移除 tp-request / daily-check error-log scan（Cowork session 失敗 surface 在 Telegram + fix-result.json，不再寫 `.error.log`），api-server `stderr` scan 保留。

**使用者手動動作**：跑 `bash scripts/migrate-launchd-to-cowork.sh` bootout 舊 LaunchDaemon + LaunchAgent，然後在 Claude Desktop 內手動建 3 個 scheduled task（task name + skill 對應在 SKILL.md 開頭「排程」段）。

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
