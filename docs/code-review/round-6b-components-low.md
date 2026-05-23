# Round 6b — src/components/ IMPORTANT + LOW + Orphan Cleanup

- **PR**: [#724](https://github.com/raychiutw/trip-planner/pull/724) (TBD)
- **Version**: v2.33.45
- **Date**: 2026-05-24
- **Scope**: src/components/ round 1 review 剩餘 IMPORTANT + 全部 LOW + orphan cleanup
- **New rule**: 從本 round 起每次 review 報告完整 finding（含 LOW）落地 `docs/code-review/`

## Findings handled

### IMPORTANT

| # | Location | Issue | Status |
|---|----------|-------|--------|
| I1 | `TimelineRail.tsx:290` `StopPoiChoiceCard` | 不 memo — alternate POI 列表每 row 跟著 RailRow 重 render | ✅ Fixed: `memo(function...)` wrap |
| I2 | `AppShell.tsx:217` | `lastYRef` 不 reset on cleanup — bottomNav 移除重 mount 時 stale | ✅ Fixed: cleanup `lastYRef.current = 0` |
| I3 | `ErrorBoundary.tsx` console.error in prod | done in round 6a | — |
| I4 | `HourlyWeather.tsx:190` for-in over Record | 不安全 (prototype keys) | ✅ Fixed: `Object.entries` |

### LOW

| # | Location | Issue | Status |
|---|----------|-------|--------|
| L1 | `Icon.tsx:141` dangerouslySetInnerHTML | Safe by construction，缺 regression 防護註解 | ✅ Fixed: 加 inline comment 警告 ICONS 必須 hardcoded |
| L2 | `DesktopSidebar.tsx:309` | `user.name.slice(0,10)` 在 surrogate pair / emoji 中間切 broken glyph | ✅ Fixed: `Array.from(name).slice(...).join('')` CJK-safe |
| L3 | `ThemeArt.tsx` | 3 個一直回 null 的 dead exports (DayHeaderArt / DividerArt / NavArt) | ✅ Fixed: 刪 3 個 dead export，保留 FooterArt |
| L4 | `MapLinks.tsx:69-71` | `loc.url` enters URL 已 `escUrl` 防 | ❌ Won't fix: already gated by escUrl + Google host fixed |
| L5 | `StopLightbox.tsx:359` | `loc.url` Google maps query fallback | ❌ Won't fix: bounded to google.com host，非 open redirect |
| L6 | `TripCardMenu.tsx:46` `position: fixed` | scoped `<style>` static，非 user input | ❌ Won't fix: safe by construction |
| L7 | TimelineRail eventsKey expensive string concat | `events.map(...).join(',')` per render | ❌ Won't fix: events.length 通常 < 20，trivial cost |
| L8 | TimelineRail sortableStyle inline object | 每 render 新 ref，但 RailRow memo 後 entry prop 變即 re-render | ❌ Won't fix: 不阻擋 RailRow memo 主作用 |
| L9 | MarkdownText useMemo benefit | inline boolean dep cheap | ❌ Won't fix: 已合理 |
| L10 | TravelPill aria-label inline template literal | trivial | ❌ Won't fix |
| L11 | CustomPoiForm inline event handlers | suggestion list ≤10 items | ❌ Won't fix |
| L12 | MapFabs locateMe no useCallback | FAB level，re-create 成本可忽略 | ❌ Won't fix |
| L13 | MapEntryCard inline style | dayColor 是 stable hex | ❌ Won't fix |

### Orphan cleanup

| File | Status |
|------|--------|
| `src/components/trip/UndoToast.tsx` | ✅ Deleted (grep 確認 0 import 全 codebase) |
| `src/components/trip/ConflictModal.tsx` (重複) | ✅ Deleted (`shared/ConflictModal.tsx` 是 canonical) |
| `src/components/trip/TripHealthBanner.tsx` | ✅ Deleted (grep 0 import — CLAUDE.md mention 為 v2.23.0 早已 unwire) |
| `src/components/trip/InfoBox.tsx` | 🔄 Defer: `safeText` 仍在 InfoBox.tsx 內被引用 + types 已搬走 — 大規模 delete 需先確認 v2.29.0 後 infoBoxes API 是否仍 surface |
| `src/components/trip/Shop.tsx` | 🔄 Defer: 同上（InfoBox 內被 render）|
| `tests/unit/conflict-modal.test.tsx` | ✅ Deleted (測 deleted component) |
| `tests/unit/undo-toast.test.tsx` | ✅ Deleted (測 deleted component) |
| `tests/unit/trip-health-banner.test.tsx` | ✅ Deleted (測 deleted component) |

### Tests added (+8)

- `confirm-modal-a11y.test.tsx` — 8 case (closed/open/Escape/backdrop click/confirm click/busy disable/warning render/Escape cleanup)

### Won't fix from agent suggestions (rationale）

| # | Suggestion | Reason |
|---|------------|--------|
| W1 | `CollabPanel.tsx:342` pass tripId directly (拔 tripIdRef indirection) | tripIdRef 在 `usePermissions` 內作 race guard (closure 抓最新值 + 不 trigger re-render)，是正確 pattern 非 anti-pattern |
| W2 | `TimelineRail.tsx:875-916` handleDragEnd stale state | 重新分析後 flow 正確：override 在 reorder 即時生效，server PATCH 完成 dispatch entry-updated → caller refetch → eventsKey 變動 → effect clear override。agent finding 過嚴 |
| W3 | Style injection helper extraction (42 callers) | 大規模 refactor，獨立 PR 處理（搬到 `ensureStyle(scope, css)` pattern via TripMapRail:23 既有 helper）|
| W4 | `OceanMap.tsx:464` marker rebuild | 巨型 OceanMap 內部優化，獨立 PR 較好 |
| W5 | `OceanMap.tsx:282` Segment dep | 同上 |
| W6 | `TripMapRail.tsx:97` scroll-spy race | 需 MutationObserver pattern，獨立 PR |
| W7 | `Segment` 拆 scalar props | OceanMap 內部 refactor |
| W8 | `Toast.tsx` module singleton cross-test pollution | 既有 `resetToasts` 已可控；React Context 版本是 round 7+ |
| W9 | `TripDatePicker` nested popover outside-click 衝突 | 當前無嵌套 popover use case |

## Backlog (defer to round 6c+)

- Test gaps: `TimelineRail focusId rail-side regression`（v2.31.93 補）/ `MapLinks` / `PageErrorState` / `InputModal` a11y
- OceanMap internal refactor (3 個 marker / segment / dep findings)
- TripMapRail scroll-spy MutationObserver
- Style helper extraction (42 callers)
- InfoBox + Shop orphan verification & deletion (需確認 infoBoxes API 是否 active)

## Tests summary

- 2237/2237 unit pass (-12 from deleted orphan tests, +8 new ConfirmModal a11y, 但 total drop 因 deleted 比 add 多)
- 既有 integration tests 不受影響
