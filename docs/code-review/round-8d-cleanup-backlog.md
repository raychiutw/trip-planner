# Round 8d — Cleanup backlog sweep (v2.33.52)

**日期**: 2026-05-24
**PR**: TBD (target: refactor/v2.33.52-cleanup-backlog → master)
**Module**: 跨模組 backlog 收尾（functions/api/oauth + src/components/trip + scripts）
**LOC**: ~280 lines changed

## 背景

Round 5d / 6c / 8d defer list 中可獨立完成、低風險、不需 mockup 的 5 個 finding 一次性 ship。
其餘需要 architectural refactor（OceanMap internals 拆分 / oauth/authorize prompt=consent / entries POST/copy batch）
留在原 defer task 等下輪 plan-eng-review。

## ✅ Fixed in this round

### 1. oauth/reset-password 加 per-IP rate limit（Round 5d defer）

**問題**: `/api/oauth/reset-password` 沒套 rate limit，attacker 可暴力嘗試 reset token / 對既有 user 連環打。
**Fix**: handler 進入時 `checkRateLimit(LOGIN policy: 5/15min, lock 30min)` → 不通過 → 429 `RESET_RATE_LIMITED`。驗證 token 失敗才 `bumpRateLimit`（成功的合法 reset 不 burn quota）。
**File**: `functions/api/oauth/reset-password.ts`

### 2. oauth/send-verification 加 per-IP + per-email rate limit（Round 5d defer）

**問題**: `/api/oauth/send-verification` 沒套 rate limit，user 可被 spam 信箱 / attacker 可 enumerate user existence by timing。
**Fix**: 同時套 per-IP + per-email `FORGOT_PASSWORD` policy（3/h, lock 1h）。anti-enumeration：兩者 message 都是統一 429 不洩漏 email 是否存在。
**File**: `functions/api/oauth/send-verification.ts`

### 3. TripMapRail scroll-spy MutationObserver fallback（Round 6c defer）

**問題**: `TripMapRail.tsx` scroll-spy `useEffect` 用 `document.querySelectorAll('[data-day]')` 一次性 attach IntersectionObserver。如果 TripPage 初次 render `<DayCard>` 還沒 mount（async fetch trip + days），observer 看不到任何 target，scroll-spy 永遠不 trigger。
**Fix**: 用 `attachIfPresent()` helper + WeakSet 去重 + MutationObserver fallback。初次找不到 → 掛 MutationObserver 監聽 `<body>` 整棵樹，detect 到第一批 `<section data-day>` mount → attach IntersectionObserver → disconnect MutationObserver。cleanup `disconnect` 兩個 observer。
**File**: `src/components/trip/TripMapRail.tsx`

### 4. launchd plist KeepAlive 改 SuccessfulExit:false + ThrottleInterval（Round 8d defer）

**問題**: `com.tripline.api-server.plist` `KeepAlive=<true/>` 無條件 respawn — api-server 正常退出（self-destruct empty queue 路徑）也會被 launchd 立刻 relaunch。同時無 `ThrottleInterval`，若 panic loop bash 1s 內死掉，launchd 會 hot-spin 重啟拉低 mac mini IO。
**Fix**: `KeepAlive` 改 dict `<SuccessfulExit><false/></...>`（exit 0 不重啟，crash exit 才重啟）+ `ThrottleInterval=10`（任何 relaunch 間隔最少 10s）+ `EnvironmentVariables.PATH` 前綴 `/opt/homebrew/bin`（tmux discovery）。
**File**: `scripts/com.tripline.api-server.plist`

### 5. daily-report.js SSRF host allowlist（Round 8d defer）

**問題**: `daily-report.js` `urls = dedup(mapsUrls).filter(/^https?:\/\//)`，attacker 控的 `trip_requests.message` 含 `http://169.254.169.254/latest/meta-data/` 之類 internal URL 也會被當 maps URL probe。Mac mini cron 跑此 script 的網路在 funnel network，能 reach 內網。
**Fix**: ALLOWED_HOSTS Set 列舉 8 個合法 maps host（maps.google / goo.gl / maps.apple / map.naver 等），`isAllowedUrl()` 先用 `new URL()` parse 拒 javascript: / file: / data:，再 hostname exact match allowlist。`urls.filter(isAllowedUrl)` 才丟 fetch。
**File**: `scripts/daily-report.js`

## 🔄 Deferred (remaining in original defer tasks)

### Round 5d 剩餘

- **oauth/authorize prompt=consent 支援**: OAuth spec 規定 `prompt=consent` 要 force re-consent screen，目前忽略。需要 redesign consent screen state machine。
- **entries POST + copy batch transaction**: 批次 add entry 目前 N+1 SQL，需要包 D1 batch transaction。Schema 改動跨多表 (`trip_entries` / `pois` / `trip_entry_pois` / `trip_segments`)，要 plan-eng-review。

### Round 6c 剩餘

- **OceanMap internals 拆分**: ~600 LOC 單一 component，markers / route layers / popup / fit-bounds logic 全擠在一起。建議拆成 `useMapMarkers` + `useMapRoute` + `useMapFit` hooks。需要 mockup-first（state machine 視覺化）。
- **CSS style helper 抽**: TimelineRail / TripMapRail / EditEntryPage 各自 inline-style 計算 priority 顏色，可抽 `lib/priorityStyles.ts`。低優先。

### Round 8d 剩餘

- **scripts/api-server.ts polish**: ~120 LOC heartbeat + tmux session spawn logic 可拆 module。低優先 (v2.33.27 per-skill lock 已穩定)。
- **scripts/logs/ 自動清理**: 目前 launchd 不轉接 log rotation。需要 logrotate.d 配置或內建 rotate logic。

## Tests

`tests/unit/cleanup-backlog.test.ts` — 12 個 source-grep test 涵蓋 5 個 fix:

- reset-password: checkRateLimit + bumpRateLimit + ipKey + RESET_RATE_LIMITED + 429
- send-verification: per-IP + per-email + VERIFY_RATE_LIMITED
- TripMapRail: MutationObserver + childList/subtree + attachIfPresent + cleanup disconnect
- plist: KeepAlive SuccessfulExit:false + ThrottleInterval + /opt/homebrew/bin
- daily-report: ALLOWED_HOSTS + protocol guard + filter(isAllowedUrl)

`npm test` 全綠 2328/2328 ✅

## Status

- ✅ 5 個 backlog finding fixed
- 🔄 6 個 remaining defer item 留在原 task
- ✅ tsc clean
- ✅ 12 個新 regression test
- ✅ 2328 個 test 全綠
