## Context

`terracotta-mockup-parity-v2` 已 ship via PR #387 / #388 / #389，但 v2 deeper QA 用 `getComputedStyle()` 進實際 DOM、跑 modal flow，發現 30 個 finding。最關鍵：typography token 偏離 mockup 規範（6 element）、NewTripModal close 用 UTF-8「✕」（違反 CLAUDE.md icon 規範）、/map desktop 不渲染 entry cards、AddStopModal 缺 region/filter。

**Constraints**：
- Tailwind 4 `@theme` token 已建立，font-size 改 `tokens.css` 全站套用
- React 19 SPA 純前端 + CSS，無 SSR / schema migration / API change
- mockup `terracotta-preview-v2.html` 是 source of truth

## Goals / Non-Goals

**Goals**：
- 字級 token 跟 mockup 規範對齊（6 element + 2 token）
- /map page 改 entry cards desktop visible + 移動 actions 到 FAB
- AddStopModal 補 region selector + filter button + 文案統一
- NewTripModal close 改 SVG（修 CLAUDE.md 違規）
- TripsListPage 補出發日 meta + 已歸檔 filter + TripInfo camelCase fix
- 1 個 PR 涵蓋全部，避免 scope drift

**Non-Goals**：
- /chat IA 從 single-conv 改 multi-conv hub（需 office-hours）
- /map 完整 day tabs filter（trip-bound /trip/:id/map 已對齊；global /map state machine 改造另 PR）
- AddStopModal 2-col POI grid 完整 search rendering（PR #387 tab 結構已 ship）
- archived_at schema migration（filter UI 先 visible，empty state 顯示等資料補完）

## Decisions

### Decision 1: Typography 用 token 改，不用 component-level override

**Choice**：改 `css/tokens.css` 的 `--font-size-body` / `--font-size-footnote` + `.tp-titlebar-title` / `.ocean-hero-title` rule 直接 hardcode 改 mockup spec value。

**Why**：Tailwind 4 `@theme` 已 expose token 全站使用，改一處影響所有 consumer，risk 收斂在 CSS 層。

### Decision 2: TripInfo interface camelCase 修 stale snake_case bug

**Choice**：把 `day_count` / `start_date` / `member_count` 改 `dayCount` / `startDate` / `memberCount` 對齊 API 實際 response（API `_utils.ts` 的 `deepCamel()` 已轉換）。順便加 `archivedAt?: string | null` 欄位給 archived filter 用。

**Why**：v2 deeper QA 發現 trip card eyebrow 缺「· N 天」、meta 缺日期 — 根因是 interface stale，runtime field 都是 undefined。改 camelCase 同時修 cardMeta + 加出發日格式「7/2 出發」。

### Decision 3: AddStopModal region 用 hardcode list

**Choice**：region dropdown options hardcode 5 個（沖繩 / 東京 / 京都 / 首爾 / 台南 + 全部地區 fallback）。

**Why**：mockup 沒明確規範 region list 是 hardcode 還是 API。Hardcode 簡單、不增 backend dependency；後續 user 旅行跨更多 city 再開 issue 加 / 改 trip.countries 動態 mapping。

### Decision 4: /map desktop entry cards rename + visibility

**Choice**：保留 `tp-global-map-mobile-cards` 既有 class（避免 selector 大改），新增 `.tp-map-entry-cards` alias 並讓 cross-viewport 都 visible，移除 `@media (max-width: 1023px) { display: block }` gate 改為 unconditional `display: block`。

**Why**：mockup section 20 規範 desktop + mobile 都顯示 entry cards horizontal scroll。改 selector 太大會影響 既有 e2e；用 alias 兩邊都認。

### Decision 5: /map「全覽 / 我的位置」 chips 改 right-bottom FAB

**Choice**：把 `.tp-global-map-actions` 從 `top-left` 改 `right-bottom`（離 entry cards stack 上方 116px）。

**Why**：mockup section 20 規範「不用 floating top day strip」+ map FAB 位置。Top-left 浮動 chip 跟 trip switcher header 視覺擁擠。

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Typography 全站改字級可能讓 layout 跑版 | E2E 跑全 viewport trip flow；CSS 改動有 test ban-list 防 regression |
| `--font-size-body` 17→16 累積 layout shift | E2E 不會 fail；用 visual regression baseline diff 確認 |
| TripInfo camelCase 改可能影響其他用 `t.day_count` 的 caller | 已 grep 確認 TripsListPage 是唯一 consumer；TypeScript strict mode 會抓殘留 snake_case |
| AddStopModal region pill 引入 ActiveTripContext dependency 沒做（hardcode 預設「全部地區」） | follow-up 加 trip-context derivation；目前 hardcode 簡單可用 |
| 「已歸檔」filter tab 沒 backend support | UI 先 visible，empty state 顯示「目前沒有已歸檔行程」+ archived_at migration follow-up |

## Migration Plan

**Step 1: Typography token sweep**（半天）
- 改 `css/tokens.css` 6 個 element / 2 token
- Commit + 跑 `bun test`

**Step 2: TripsListPage**（1-2h）
- TripInfo camelCase fix + cardMeta startDateMD + 已歸檔 filter
- Commit + 跑 unit test

**Step 3: NewTripModal SVG close**（30min）
- close button 改 `<Icon name="x-mark" />` + h2 weight 700
- Commit

**Step 4: AddStopModal region/filter**（2h）
- region pill + filter button + footer counter + dayLabel format
- Commit

**Step 5: /map + GlobalBottomNav + Icon**（1h）
- GlobalMapPage class alias + actions FAB position
- GlobalBottomNav span 11/14/700
- Icon registry 補 chevron-down/filter/target
- Commit

**Step 6: Documentation + tests**（1h）
- DESIGN.md type scale 章節更新
- Add unit / e2e tests
- Commit + push + PR

**Rollback**：每 step 對應 commit。Step 1 typography 是基礎，rollback 後續 step 都會視覺退回，schema/data 不受影響。

## Open Questions

1. **AddStopModal region 5 個夠不夠？** 目前覆蓋主要市場。後續 user 拓展再加。
2. **archived_at schema migration 何時做？** Follow-up issue 追蹤。
3. **/map global day tabs 何時做？** 需要 GlobalMapPage state machine 改造。trip-bound /trip/:id/map 已對齊，可分開做。
