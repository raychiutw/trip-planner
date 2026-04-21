# TODOs

已知待辦與 follow-up。按 Skill/Component 分組，每項標 Priority。

**Priority**：
- **P0** — 現在就該修（阻擋使用 / 資料損失 / 安全性）
- **P1** — 下一個 sprint 要修（明顯影響使用者體驗）
- **P2** — 有空就修（少數人踩到、體驗小瑕疵）
- **P3** — 想做再做（nice-to-have）
- **P4** — 可能不做（長期觀察）

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

**Source**: autoplan Design retro — Q10=A 選 editorial 但實作仍是「editorial token 包 dashboard」。TripPage 第一屏 6 層 chrome（topbar + DayNav + Hero + 警語 + 天氣 + Hotel）before 第一個 stop content。

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

## Completed

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
