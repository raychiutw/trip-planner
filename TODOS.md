# TODOs

已知待辦與 follow-up。按 Skill/Component 分組，每項標 Priority。

**Priority**：
- **P0** — 現在就該修（阻擋使用 / 資料損失 / 安全性）
- **P1** — 下一個 sprint 要修（明顯影響使用者體驗）
- **P2** — 有空就修（少數人踩到、體驗小瑕疵）
- **P3** — 想做再做（nice-to-have）
- **P4** — 可能不做（長期觀察）

## DayNav / Scroll Spy

### Mobile URL bar 收縮造成 active pill 抖動

**Priority:** P2
**Source:** PR #182 adversarial review finding #3（confidence 85%）

在 mobile Chrome / Safari，使用者捲動時 URL bar 會收縮，`window.innerHeight` 從約 600 跳到約 660。`src/lib/scrollSpy.ts` 的 threshold 用了 `innerHeight`，邊界情境（day header top 剛好落在新舊 threshold 中間，約 20px 區間）active pill 可能 toggle 一次。

**實務影響**：小。`TripPage.tsx` 的 `scrollDayRef.current !== activeDayNum` dedup guard 避免重複 `switchDay` call；CSS sliding indicator 的 spring transition 會平滑 absorb 短暫切換。但用嚴格標準仍是 bug。

**修法選項**：
- 改用 `document.documentElement.clientHeight`（layout viewport，mobile 穩定）
- 或 cache `innerHeight` 一次，scroll 期間不重讀（resize 才更新）
- 或加 hysteresis：active pill 「離開」門檻比「進入」大 ~50px

### Print mode scroll listener 沒 teardown

**Priority:** P3
**Source:** PR #182 adversarial review finding #2

`TripPage.tsx` 的 onScroll effect deps 為 `[loading, dayNums, switchDay]`，不含 `isPrintMode`。進入 print mode 後 scroll listener 繼續存活，仍會 `switchDay()` 觸發 state update。實際使用者不會在 print mode 捲太久，影響很小。

**修法**：effect 加 `isPrintMode` 依賴，print mode 下 early return。

### `scrollDayRef.current` 跨行程 stale

**Priority:** P3
**Source:** PR #182 adversarial review finding #6

`scrollDayRef = useRef(0)` 在行程切換後（`handleTripChange`）不會 reset。若前後兩趟行程都在 Day 1 結束，`scrollDayRef.current === 1` 時不會呼叫 `switchDay(1)`，導致新行程載入後 hash 殘留舊值。active pill 視覺不受影響（由 `currentDayNum` 控制）。

**修法**：`handleTripChange` 加 `scrollDayRef.current = 0`。

### 單天行程 hash 永不更新

**Priority:** P4
**Source:** PR #182 adversarial review finding #5

若行程只有一天且頁面內容短於 viewport 高度，使用者無法捲動，`onScroll` 不會觸發，URL hash 停在初始值或空。`currentDayNum` 由 `useTrip` 的 `first.dayNum` 初始化，所以 active pill 正確，純 URL hash 問題。

**修法**：`TripPage` 初次 resolve 完 trip 後，同步 push `#day${firstDayNum}` 到 URL。

## Documentation

### 補 docs 資料夾截圖

**Priority:** P3
**Source:** README 引用 `docs/daily-report-flow.png` 但該資料夾可能不存在

README.md 第 47 行 `![每日行程流程](docs/daily-report-flow.png)` 若 `docs/` 不存在或檔名錯，README 會顯示 broken image。待確認並補上或移除。

## Observability

### `api_logs` source 欄位的 scheduler / companion 仍是 self-reported

**Priority:** P3
**Source:** `functions/api/_middleware.ts:35-36` 註解已標註
**Context:** 見 [ARCHITECTURE.md](ARCHITECTURE.md) Auth 段落「信任邊界重點」

`detectSource()` 是 self-reported telemetry，不是 auth decision。daily-check 做 escalation 時只看 source 會被繞過。目前靠 path + error code secondary signal，還算穩。長期若要收斂成單一驗證點，需重設計 header 簽章或換 Cloudflare Service Token 分流。

## Tests

### Regression test for request scheduler timezone bug

**Priority:** P2
**Source:** PR #171 commit `9f414da`（`fix: daily-check todayISO() 使用本地時區`）

舊 bug 是跨午夜區間用 UTC 判「今天」造成漏信。修復時沒加 regression test。補一個能模擬伺服器時區切換的測試。

---

## Completed

<!-- 完成的項目搬到這裡，加 `**Completed:** vX.Y.Z (YYYY-MM-DD)` -->

### DayNav scroll spy 閾值標錯日

**Priority:** P1
**Completed:** v1.2.3.5 (2026-04-17)
**PR:** [#182](https://github.com/raychiutw/trip-planner/pull/182)

捲動到 Day N header 完整顯示在 sticky nav 下方時 active pill 仍停在 Day N−1。閾值從 `navH + 10` 改為 `navH + (innerHeight − navH) / 3`，並抽成 `src/lib/scrollSpy.ts` pure function + 10 條 regression test。

### 防止 GET /days/undefined 404

**Priority:** P1
**Completed:** v1.2.3.4 (2026-04-16)
**PR:** [#180](https://github.com/raychiutw/trip-planner/pull/180)

`fetchDay` 加 `Number.isInteger` 守門避免 undefined/NaN 發出 API 請求。

### CI 自動 apply D1 migrations

**Priority:** P1
**Completed:** v1.2.3.3 (2026-04-13)
**PR:** [#178](https://github.com/raychiutw/trip-planner/pull/178)

關閉 Cloudflare Pages 部署 worker 但 D1 schema 未更新的 race window。
