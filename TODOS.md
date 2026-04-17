# TODOs

已知待辦與 follow-up。按 Skill/Component 分組，每項標 Priority。

**Priority**：
- **P0** — 現在就該修（阻擋使用 / 資料損失 / 安全性）
- **P1** — 下一個 sprint 要修（明顯影響使用者體驗）
- **P2** — 有空就修（少數人踩到、體驗小瑕疵）
- **P3** — 想做再做（nice-to-have）
- **P4** — 可能不做（長期觀察）

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
