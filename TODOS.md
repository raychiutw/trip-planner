# TODOs

已知待辦與 follow-up。按 Skill/Component 分組，每項標 Priority。

**Priority**：
- **P0** — 現在就該修（阻擋使用 / 資料損失 / 安全性）
- **P1** — 下一個 sprint 要修（明顯影響使用者體驗）
- **P2** — 有空就修（少數人踩到、體驗小瑕疵）
- **P3** — 想做再做（nice-to-have）
- **P4** — 可能不做（長期觀察）

---

## Middleware service-token auth bypass — non-admin service token 繼承 ADMIN_EMAIL trip permissions

**Found by**: /ship Codex adversarial on v2.19.13 PR (branch fix/entry-action-get-405-and-edit-trip-form-id, 2026-05-03)
**Symptom**: `functions/api/_middleware.ts:325` 對所有 client_credentials service token 設 `email = env.ADMIN_EMAIL`（無論 scopes 是否含 admin）。雖然 `isAdmin` 正確 gate 在 `scopes.includes('admin')`，但 email 變成 admin 的後，`hasPermission(db, auth.email, tripId, false)` SQL lookup 用 admin email 在 `trip_permissions` 表找 → 找到 → grant read。`hasWritePermission` 同樣破。
**Real-world impact**: 影響所有用 `hasPermission` / `hasWritePermission` 的 endpoint（50+），含 trips/entries/days/docs/permissions 全部 PATCH/DELETE/GET。
**現狀 mitigation**: CLAUDE.md 規定 service token 只能由 admin 透過 `scripts/provision-admin-cli-client.js` 一次性 provision。目前只有 1 個 admin CLI client（含 admin scope）。所以 *目前* 沒實際 exploit case。但只要任何 future 流程 issue 一個 non-admin scope 的 client_credentials token（e.g. 第三方 dashboard, integration），這個 token 立刻擁有 admin trips 的全 CRUD 權限。
**Fix options**:
1. `_middleware.ts:325` 對非 admin scope service token 設 `email = ''`(empty string)，讓 hasPermission SQL lookup 找不到 row。最小改動。
2. 加 `auth.isServiceToken` 旗標到 AuthData，`hasPermission` / `hasWritePermission` 對 isServiceToken=true 且 isAdmin=false 直接拒。更明確。
3. Provision script 強制只能 issue `admin` scope token (去掉 non-admin issuance 路徑)。
**Verify after fix**: 寫 integration test cover「non-admin service token + 別人的 trip → 403」。
**Est**: 0.5-1 hr CC（含 audit + tests）
**Priority**: **P0**（latent auth bypass，目前無 exploit case 因只有 1 個 admin client，但任何 non-admin client 一 issue 就破，且影響 50+ endpoints）

---

## EntryActionPage / AddStopPage — API response snake/camel mismatch (Day 「空」 label)

**Found by**: /office-hours implementation of P1 onRequestGet (2026-05-03)
**Symptom**: `functions/api/_utils.ts:json()` 對所有 response 跑 `deepCamel` snake→camel,但 EntryActionPage L265-273 + AddStopPage L156, L635 還在讀 `d.day_num / d.day_of_week / d.entry_count / entryData.day_id`。real API 出 `dayNum / dayOfWeek / entryCount / dayId`,page 讀到全 undefined → day picker label 顯示「Day 空 7/1」(沒 day number),current day 不 highlight,stop count 永遠 0。功能仍 work(date+click 還在),純 cosmetic degrade。
**Fix**:
1. EntryActionPage interfaces L58-67 + reads L265-273 改 camelCase
2. AddStopPage L156 + L635 改 camelCase
3. tests/e2e/api-mocks.js MOCK_DAYS_* 拿掉 dual-key,只保留 camelCase
**Est**: 15 min CC
**Priority**: P2 (cosmetic but visible — picker 看起來壞掉)

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

## OG Preview — Dynamic per-trip image

**Current**: 所有 trip 用 static brand OG (`/og/tripline-default.png`).
**Goal**: 每個 trip 有動態 OG image 顯示行程名 + 天數 + 目的地.
**Blockers**:
- Cloudflare Workers 的 Satori/@vercel/og 相容性驗證
- 字型（Noto Sans TC）在 Worker 載入
- Cache strategy（/api/og/:tripId → KV cache 24h）
**Est**: 1 day CC (medium)
**Priority**: P2 (static MVP 已 unblock distribution)

---

## Reader Validation Framework

**Source**: autoplan CEO retro（v2.0.2.3）發現 — Tripline 有 7 個行程、1 個 admin、**0 個非技術旅伴實測過**。所有 UI 決策在真空中做。是 design-review-v2 10 問**沒問到**的最大 gap。

**Goal**: 建立非技術旅伴使用行為觀察機制，讓 UI 決策有 ground truth。

**步驟**:
1. 定義 3 個 must-pass 使用者任務：
   - 「找到今天吃什麼」（3 分鐘內）
   - 「第幾天去哪裡」（2 分鐘內）
   - 「這個景點要多久」（1 分鐘內）
2. 招 2-3 個非技術旅伴（家人 / 朋友 / 同事），給 `https://trip-planner-dby.pages.dev/trip/okinawa-trip-2026-Ray` URL
3. 錄 5 分鐘 screen recording（手機）+ think-aloud protocol
4. 記錄卡點、困惑詞彙、完成時間
5. 結果寫 `docs/reader-validation-2026-05.md`，列出 top 3 friction
6. 下個 design cycle 以此為 input（取代「我覺得」）

**Est**: 0.5 day（非技術，找人 + 觀察 + 整理）
**Priority**: P1（block 下一個 design cycle 的方向感）

---

## Creator Onboarding — Public entry

**Source**: autoplan CEO retro — Tripline 目前僅 admin `lean.lean@gmail.com` 可建行程，**沒 public `/new` 或 waitlist**。Dream state「10+ creator」的 funnel 入口缺。

**Goal**: 讓潛在 creator 有入口知道 Tripline 存在 + 表達興趣 / 試用。

**選項**:
- **MVP A**：`/new` 顯示「目前 closed beta，留信箱加入 waitlist」+ 最簡 email 收集表單 → D1 `waitlist` 表
- **MVP B**：`/about` landing 頁介紹 Tripline + 一個 CTA 連到 demo trip（讀為主展示）
- **Full**：`/signup` + OAuth + creator dashboard（跟現有 Cloudflare Access 衝突需重設計）

**推薦**：**MVP A + MVP B 合併**（一個 landing `/` 顯示 Tripline 簡介 + demo link + waitlist CTA）。尊重現有架構，不碰 auth。

**Blocker**:
- 產品決策：Tripline 是 invite-only curator-driven 還是 open signup？（影響 funnel 設計）
- 法律：waitlist 需要 privacy notice + GDPR 基本條款

**Est**: 1 day（含 email 收集 D1 schema + form + privacy copy）
**Priority**: P2（依賴 reader validation 找到真使用者 pattern 先）

---

## Editorial Follow-through — Chrome density 檢討

**Source**: autoplan Design retro — Q10=A 選 editorial 但實作仍是「editorial token 包 dashboard」。TripPage 第一屏仍有多層 chrome（topbar + DayNav + Hero + 警語 + 天氣）before 第一個 stop content。（v2.0.3.0 R19 已移除 Hotel card 與交通統計 card，首屏少一層，但 editorial density 議題仍在。）

**Goal**: 讓「editorial = 內容主角」真的在第一屏落地。

**選項**:
- TripPage 首屏只留 topbar + Hero，其他資訊收合進 Hero 下方 expandable
- 或：Hero 瘦身（變成 editorial 式大標 + 日期 + 地區，不塞 stats），stats 下移
- 或：DayNav 首次只顯示當天 + 「看全部」按鈕

**Blocker**: 需要 reader validation 先（避免刪掉使用者其實需要的 chrome）

**Est**: 1 day
**Priority**: P2（依賴 reader validation）

---

## Observability

### `api_logs` source 欄位的 scheduler / companion 仍是 self-reported

**Priority:** P3
**Status:** NEEDS /plan-eng-review（架構議題，非 quick fix）
**Source:** `functions/api/_middleware.ts:35-36` 註解已標註
**Context:** 見 [ARCHITECTURE.md](ARCHITECTURE.md) Auth 段落「信任邊界重點」

`detectSource()` 是 self-reported telemetry，不是 auth decision。daily-check 做 escalation 時只看 source 會被繞過。目前靠 path + error code 等 secondary signal 做 defense in depth，還算穩。

長期若要收斂成單一驗證點需重設計：

**選項 A**：在 scheduler / companion 端加 HMAC 簽章 header，middleware 驗簽才接受 `X-Tripline-Source` 宣告。優點可驗證、缺點金鑰管理成本。

**選項 B**：改用 Cloudflare Service Token，不同 token 對應不同 source，`CF-Access-Client-Id` 直接是身份識別。優點 CF 原生支援、缺點綁 Cloudflare、Service Token 輪換有運維成本。

**選項 C**：接受現況，在 daily-check escalation 邏輯加更多 secondary signals（URL 路徑、error code 分布、IP reputation 等），不靠 source 單點。成本最低、防禦層次多。

建議先跑 `/office-hours` 探索威脅模型與業務影響，再 `/plan-eng-review` 選方案。**不適合塞進小 PR 直接做**。

---

## poi-favorites-rename — Pre-merge gates (admin / SRE actions)

### admin — provision TRIPLINE_API_TOKEN + TP_REQUEST_CLIENT_ID Pages secrets

**Priority:** P0 — blocks merge of PR #474
**Source:** `openspec/changes/poi-favorites-rename/tasks.md` §1.2, §1.4
**Symptom:** `TRIPLINE_API_TOKEN` 未 provisioned in Cloudflare Pages env → companion path 全 401。

**步驟：**
1. admin re-run `node scripts/provision-admin-cli-client.js`（已加 `companion` scope）取得新 client_secret（一次性 print）
2. 用 `curl -X POST /api/oauth/token` with `client_credentials` + `client_secret` 換 access_token（含 `admin + companion` scopes）
3. `wrangler pages secret put TRIPLINE_API_TOKEN --project-name trip-planner` 設為 access_token
4. `wrangler pages secret put TP_REQUEST_CLIENT_ID --project-name trip-planner` 設為 `tripline-internal-cli`
5. `wrangler pages secret list --project-name trip-planner` verify 兩個都有

完成才能 merge PR #474。

### SRE — mac mini cron sync (URL + OAuth token)

**Priority:** P0 — blocks merge of PR #474
**Source:** `openspec/changes/poi-favorites-rename/tasks.md` §1.3, §19
**Symptom:** mac mini cron `scripts/tp-request-scheduler.sh` 還在打 `/api/saved-pois`（middleware 白名單已 cutover 到 `/api/poi-favorites`）→ companion 會 403。

**步驟：**
1. SSH mac mini 改 `scripts/tp-request-scheduler.sh` base URL 4 條 endpoint：`/api/saved-pois*` → `/api/poi-favorites*`
2. 換新 OAuth token（admin re-mint 含 `admin + companion` scope）並更新 cron env var
3. dry-run smoke：trigger 測試 trip_requests row → assert tp-request 處理成功 + companion path 200
4. PR description 附 commit hash / config diff / dry-run output 證據

---

## poi-favorites-rename — UI mockup-driven redesigns (PoiFavoritesPage + AddPoiFavoriteToTripPage)

**Priority:** P2 — mockup signed-off (`docs/design-sessions/2026-05-04-favorites-redesign.html` v4)，React refactor 留 follow-up
**Source:** `openspec/changes/poi-favorites-rename/tasks.md` §11.3-§11.10, §12.3-§12.11

**Scope:**

§11 PoiFavoritesPage redesign（mockup-driven hard gate）：
- region pill row + type filter row 對齊 mockup
- 8-state matrix（loading / empty-pool / filter-no-results / error / data / optimistic-delete / bulk-action-busy / pagination）
- batch flow delete-only（不支援 batch add-to-trip — DUC1 user accept）
- a11y: filter chip `role="group"` + `aria-pressed`（不是 `role="tab"`）/ checkbox `aria-label` per row / optimistic-delete `aria-live`
- viewport breakpoints: 1024+ 3-col / 640-1023 2-col / <430 1-col / max-width 1040px
- hierarchy rules: 0 favorites 隱藏 filters / 50 grid 為主 / 200+ sticky search + pagination
- 8 處 `border: 1px solid var(--color-border)` 違反 H7 一併修（從 master SavedPoisPage 繼承的 pre-existing pattern）

§12 AddPoiFavoriteToTripPage redesign：
- 4-field 純時間驅動 form（trip / day / startTime / endTime）— 廢除 position radio + anchorEntryId
- desktop 2-col grid（max-width 720px）/ phone stack 單欄 + button full-width
- TitleBar title 靠左（flex:1）/ 左側返回 button / 右側無 confirm action
- 「加入行程」primary button 在 `.tp-form-actions` wrapper 內、置中對齊、放在 4 fields 下方
- 7-state matrix（loading / empty-no-trip / conflict / error / success / optimistic / partial）
- trip 切換時 day field skeleton + 提交按鈕 disabled

**建議 flow：** invoke `/tp-claude-design` 對照 mockup 產 React → invoke `/design-review` 視覺稽核 → /tp-code-verify。

---

## poi-favorites-rename — Migration 0051 cleanup PR (DROP saved_pois)

**Priority:** P2 — schedule after migration 0050 soak ≥ 1 week
**Source:** `openspec/changes/poi-favorites-rename/tasks.md` §24

**Schedule:** 2026-05-11 之後（PR #474 merge + soak 1 week）。

**Steps:**
- §24.1 寫 migration 0051：`DROP TABLE saved_pois`
- §24.2 移除 dual-read code path（handler 不再 fallback 試 saved_pois — 本 PR 已用 hard cutover，dual-read 實際未實作，但 verify 沒殘留 fallback try-catch）
- §24.3 verify dual-read 期間 zero traffic 打到 saved_pois（D1 query: `SELECT COUNT(*) FROM saved_pois WHERE saved_at > <PR-merge-timestamp>` 應為 0）
- §24.4 archive `openspec/changes/poi-favorites-rename/` → `openspec/changes/archive/2026-05-XX-poi-favorites-rename/`

---

## poi-favorites-rename — Shared components + skill / doc refinement

**Priority:** P3 — quality-of-life，無功能阻擋
**Source:** `openspec/changes/poi-favorites-rename/tasks.md` §13/§15/§16/§17/§18.3

**Items:**

§13 Shared component 抽取（與 §11/§12 mockup-driven redesign 一併處理較順）：
- 抽 `<PageErrorState>` 共用 component 取代 `.favorites-error` inline pattern
- 抽 `<EmptyState>` 共用 component 取代 `.favorites-empty-cta` inline pattern
- 抽 `tp-action-btn` family 取代 `.favorites-toolbar-btn` 系列至 `css/components/action-button.css`

§15 tp-request SKILL.md「加入收藏」flow（DX-F6.1 — 30s skim discoverability）：
- 加 H3 段「3d.j 加入收藏 sub-flow」（top-level，不在 references 內藏）
- 5 步流程 curl：(1) Google Maps 驗證 (2) GET /api/pois?name=X 取 poiId (3) POST /api/poi-favorites with companionRequestId + Bearer + X-Request-Scope (4) 處理 201/409/404/401 (5) PATCH /api/requests/:id status=completed
- 401 debug 3-step checklist：(a) curl /api/oauth/introspect 確認 token (b) D1 SELECT id, status, submitted_by FROM trip_requests WHERE id=? (c) D1 SELECT id FROM users WHERE LOWER(email)=LOWER(?)

§16 mockup-first systematic gate（部分已落 CLAUDE.md，Naming history 補完）：
- §16.1 tp-team SKILL.md Build phase 加 sub-section「Mockup-first hard gate」展開規則
- §16.3 CLAUDE.md 加「Naming history」section（saved_pois → poi_favorites, migration 0050, v2.22.0）
- §16.4 DESIGN.md 加「Naming history」同上
- §16.5 ARCHITECTURE.md 加「Naming history」同上

§17 DESIGN.md asymmetric labels rewrite（9 處）：
- L298 廢除「DesktopSidebar label 用『我的收藏』...asymmetric labels intentional」改為「Sidebar 與 BottomNav 第 4 slot 統一『收藏』，ownership 由 PoiFavoritesPage hero eyebrow 補回」
- L259 TitleBar 文字「我的收藏」→「收藏」
- L317 路由表 `/saved` → `/favorites`、`/saved-pois/:id/add-to-trip` → `/favorites/:id/add-to-trip`
- L484 SavedPoisPage 收藏批次刪除 → PoiFavoritesPage
- L565-657 整段「saved_pois universal pool」rename → 「poi_favorites universal pool」+ table/api/route 全 rename
- 補 batch flow delete-only 規範
- 補 PoiFavoritesPage 8-state matrix（取代原 5-state）
- 補 viewport breakpoints + a11y 規範

§18.3 archive saved-pois-schema banner：
- 修改 `openspec/changes/archive/2026-04-25-layout-overlay-rules-and-schema/specs/saved-pois-schema/` README 頂端加 banner：`> ⚠️ Renamed to poi_favorites in migration 0050 — see openspec/changes/archive/2026-05-XX-poi-favorites-rename/`（archive 後 §24.4 才知最終 path）

---

## V2-P6 — rate_limit_buckets cleanup CRON 沒實作

**Priority:** P3 — pre-existing tech debt（V2-P6 brute-force defence migration 0035），本 PR 未引入
**Source:** `migrations/0035_rate_limit_buckets.sql:26-29` 註解
**Symptom:** `migrations/0035` 註解承諾「V2-P6 cron job 每小時跑 DELETE WHERE locked_until IS NULL AND window_start + 1h < now」清過期 unlocked rows，但 cron 未在 repo 設定（`wrangler.toml [triggers]` 無 schedule）。`rate_limit_buckets` table 隨每個 unique bucket key（每個用過 POST 的 user / companion / IP）持續累積，long-running prod 會 index bloat。

**Fix options:**
- A) 加 `wrangler.toml [triggers] crons = ["0 * * * *"]` + `functions/_scheduled.ts` cleanup handler
- B) opportunistic delete inside `bumpRateLimit`（1% probability `DELETE WHERE window_start+windowMs < ? AND locked_until IS NULL`）

A 是標準做法但需 cron handler；B 簡單但 latency tail 可能受 1% 隨機影響。建議獨立 PR 處理。

---

## Completed

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
