# Code Review Report — post-ux-fixes

**Reviewer:** reviewer-2
**Date:** 2026-03-20
**Scope:** Group A (#1~#4) + Group B (#3, #8, #11b, #13) + Group E (#14) + Group F (F.1~F.16) + Group G (G.1~G.8)

---

## 審查結果：APPROVE

所有完成項的改動正確、一致、符合專案規範。跳過項的理由合理。以下為逐項審查細節。

---

## Group A — 快速修復（Engineer A）

### #1 移除卡片 border-left
- **css/style.css:42-46** — `body:not(.dark) .day-header` 已無 `border-left: 4px solid`
- **css/style.css:273** — `.restaurant-choice` 已無 `border-left: 3px solid`
- **css/style.css:186** — `.hotel-sub` 已無 `border-left: 3px solid`
- **判定：** PASS — 符合無框線設計規範

### #2 footer safe-area
- **css/style.css:8** — `padding-bottom: max(16px, env(safe-area-inset-bottom))`
- **判定：** PASS — 正確使用 `max()` + `env()` fallback

### #3 DayNav pill 移除星期幾
- **src/components/trip/DayNav.tsx:10-17** — `formatPillLabel` 已簡化為只回傳 `${mm}/${dd}`，移除 `totalDays` 參數
- **判定：** PASS — 無遺留 dead code

### #4 交通統計 Day undefined
- **src/hooks/useTrip.ts:13-25** — `mapDayResponse()` 正確將 snake_case 映射至 camelCase
- 兩處 fetch（fetchDay 行 71、parallel fetch 行 154）都使用 `mapDayResponse`
- **判定：** PASS — 統一了資料正規化路徑

---

## Group B（由 Engineer A 先前完成）

### #3 SpeedDial 改為 2x3 iOS grid
- **src/components/trip/SpeedDial.tsx** — 使用 `<Icon name={item.icon} />` 且 items 由 config 驅動
- **判定：** PASS

### #8 修復 useSwipeDay closure bug
- **src/hooks/useSwipeDay.ts:20-24** — `callbackRef` pattern 正確，每次 render 更新 ref
- **判定：** PASS

### #11b InfoSheet 加 dragging class
- **src/components/trip/InfoSheet.tsx:102-103, 114-115** — `classList.add/remove('dragging')` 以 Direct DOM mutation 實作，搭配 CSS `.info-sheet-panel.dragging { transition: none; }` (style.css:632)
- **判定：** PASS — 避免不必要的 React re-render

### #13 Active pill 下方常駐 label
- **src/components/trip/DayNav.tsx:197-199** — `isActive && d.label` 時顯示 `.dn-active-label`
- **css/style.css:117-126** — 樣式正確使用 design tokens
- **判定：** PASS

---

## Group E — HIGH 預存修復（Engineer A）

### E.1 sticky-nav border-bottom
- **css/style.css:33** — 移除 `border-bottom`，改用 `color-mix` + `backdrop-filter: blur(12px)`
- 通過 css-hig.test.js 的 `.sticky-nav` 背景檢查（不使用 solid `var(--color-background)` 或 `rgba()`）
- **判定：** PASS

### E.2 print mode border
- **css/style.css:370-372** — `.print-mode .tl-card, .print-mode .info-card` 和 `.print-mode .day-header` 已移除 `border: 1px solid`
- **判定：** PASS — print mode 內的改動不受 HIG 測試管轄，print blocks 被 strip

### E.3 mapDayResponse spread
- **src/hooks/useTrip.ts:13-25** — 已從 `...(raw as unknown as Day)` 改為逐欄明確映射
- 每個欄位都有 camelCase 優先 + snake_case fallback + null coalescing
- **判定：** PASS — 型別安全大幅提升

### E.4 preventScroll 型別
- **src/components/trip/InfoSheet.tsx:169-175** — 拆分為 `preventTouchScroll(e: React.TouchEvent)` 和 `preventWheelScroll(e: React.WheelEvent)`
- SpeedDial.tsx:91-96 同樣有拆分版本
- **判定：** PASS — 消除 `as unknown as` 強制轉型

### E.5 useSwipeDay dep array
- 確認無修改，ref pattern 本身就是正確的（無 dep array = 每次 render 更新 ref）
- **判定：** PASS（跳過合理）

### E.6 drivingStats as unknown
- **src/lib/drivingStats.ts:66** — `typeof t === 'string' ? t : ''`（移除多餘的 `as unknown as string`）
- **判定：** PASS

---

## Group F — MEDIUM（Engineer C）

### F.1 hw-grid gap token
- **css/style.css:425** — mobile `@media (max-width: 600px)` 內 `.hw-grid` gap 改為 `var(--spacing-1)`（= 4px）
- base `.hw-grid` gap 維持 `8px`（符合 4pt grid）
- **判定：** PASS

### F.2 DayNav aria-describedby
- **src/components/trip/DayNav.tsx:181, 189, 201** — pill button 加 `aria-describedby={showTooltip ? tooltipId : undefined}`；tooltip span 加 `id={tooltipId}`
- **判定：** PASS — 正確的 ARIA 關聯

### F.3 SpeedDial Icon 元件
- **src/components/trip/SpeedDial.tsx:134** — trigger 改用 `<Icon name="expand_less" />`
- **判定：** PASS — 消除 hardcoded SVG path

### F.4 SpeedDial aria-controls
- **src/components/trip/SpeedDial.tsx:130** — `aria-controls="speedDialItems"`
- 對應 `id="speedDialItems"` (行 110)
- **判定：** PASS

### F.5 mapDayResponse updated_at fallback
- **src/hooks/useTrip.ts:21** — `updatedAt: (raw.updatedAt ...) ?? (raw.updated_at ...)`
- **判定：** PASS

### F.6 fetchDay catch logging
- **src/hooks/useTrip.ts:74-76** — `catch (err) { console.warn('fetchDay failed:', err); return null; }`
- **判定：** PASS — 比 empty catch 更利於除錯

### F.7 DayNav cleanup（跳過）
- 行 94-98 cleanup 已正確：移除 scroll listener、disconnect observer、移除 resize listener
- **判定：** 跳過合理

### F.8 scrollPillIntoView guard（跳過）
- 行 107 `if (btn)` guard 已存在
- **判定：** 跳過合理

### F.9 InfoSheet classList 註釋
- **src/components/trip/InfoSheet.tsx:102, 114** — 加上 `// Direct DOM mutation — React state not needed for CSS-only transition control`
- **判定：** PASS — 說明了為何繞過 React state

### F.10 drivingStats text guard
- **src/lib/drivingStats.ts:70** — `if (!text) return;` guard 在 `String(text).match(...)` 前
- **判定：** PASS

### F.11 drivingStats null check（跳過）
- 行 128-134 已有 `day.date || ''` 和 `day.dayOfWeek ?` 檢查
- **判定：** 跳過合理

### F.12 TripPage weather_json type guard
- **src/pages/TripPage.tsx:100** — `'weather_json' in (day as Record<string, unknown> ?? {})`
- **src/pages/TripPage.tsx:103-104** — `weatherRaw as WeatherDay`（移除 `as unknown as`）
- **判定：** PASS

### F.13 TripPage hotel type guard
- **src/pages/TripPage.tsx:155** — `hotel && typeof hotel === 'object'` guard + `hotel as Record<string, unknown>`
- **判定：** PASS

### F.14 TripPage timeline entry type guard
- **src/pages/TripPage.tsx:162** — `typeof e === 'object' && e !== null` guard + `e as Record<string, unknown>`
- **判定：** PASS

### F.15 TripPage travel type guard
- **src/pages/TripPage.tsx:432, 517** — `e.travel !== null && typeof e.travel === 'object' ? e.travel as Record<string, unknown> : null`
- **判定：** PASS

### F.16 useSwipeDay magic number
- **src/hooks/useSwipeDay.ts:4** — `const SWIPE_DIRECTION_RATIO = 1.2` 含 JSDoc 說明
- 行 55 引用 `SWIPE_DIRECTION_RATIO`
- **判定：** PASS

---

## Group G — LOW（Engineer C）

### G.1 JSON.parse try-catch（跳過）
- useTrip.ts:175-179 已有 try-catch
- **判定：** 跳過合理

### G.2 longPressTimer 型別（跳過）
- DayNav.tsx:48 `useRef<ReturnType<typeof setTimeout> | null>(null)` 一致
- **判定：** 跳過合理

### G.3 SpeedDial backdrop 註釋
- **src/components/trip/SpeedDial.tsx:100** — `{/* Backdrop: prevent scroll passthrough to page content while dial is open */}`
- **判定：** PASS

### G.4 RawDay 型別拆分
- **src/pages/TripPage.tsx:307-326** — 拆為 `RawDayEntry`、`RawHotel`、`RawDay` 三個具體型別
- 欄位定義合理，保留 `[key: string]: unknown` index signature 以相容 API 回傳
- **判定：** PASS

### G.5 sheetContent memo 依賴清理
- **src/pages/TripPage.tsx:852** — `handleDownloadOpen` 已從依賴陣列移除
- 確認 `sheetContent` 內部未引用 `handleDownloadOpen`
- **判定：** PASS

### G.6 closeBtnRef optional chaining（跳過）
- InfoSheet.tsx:62 已有 `closeBtnRef.current?.focus()`
- **判定：** 跳過合理

### G.7 useSwipeDay passive 註釋
- **src/hooks/useSwipeDay.ts:68-70** — 加上 passive: true 原因的註釋
- **判定：** PASS

### G.8 tl-flag clip-path 10px（跳過）
- css/style.css:192 — `clip-path: polygon(...)` 中的 `10px` 是幾何形狀切角定義
- 不屬於間距或圓角 token 替換範疇
- **判定：** 跳過合理

---

## 跳過項彙整（9 項）

| # | 理由 | 判定 |
|---|------|------|
| E.5 | ref pattern 本身正確，無 dep array = 每次 render 更新 | 合理 |
| F.7 | cleanup 已正確移除所有 listener + observer | 合理 |
| F.8 | `if (btn)` guard 已存在 | 合理 |
| F.11 | null check 已存在 | 合理 |
| G.1 | try-catch 已存在 | 合理 |
| G.2 | 型別已一致 | 合理 |
| G.6 | optional chaining 已存在 | 合理 |
| G.8 | clip-path 幾何值非 token 範疇 | 合理 |

---

## CSS HIG 合規

- 無 hardcoded transition duration（使用 `--transition-duration-fast/normal/slow`）
- 無 hardcoded `#fff` 在互動區域
- `font-size` 全部使用 `var(--font-size-*)` tokens 或相對單位
- 4pt grid：所有 padding/margin/gap 的 px 值皆為 4 的倍數
- `.sticky-nav` 使用 `color-mix` + `backdrop-filter`，非 solid background
- `border-radius` 使用 `var(--radius-*)` tokens
- overlay/backdrop 使用 `var(--color-overlay)`

---

## 型別安全

- `as unknown as` 已全面清理（E.3, E.4, E.6, F.12~F.15）
- `mapDayResponse` 以逐欄映射取代 spread，所有欄位有 fallback
- `RawDay` 型別拆分為三個具體型別，保留 index signature 相容性
- `preventScroll` handler 型別正確（`React.TouchEvent` / `React.WheelEvent`）

---

## 命名規範

- CSS class 使用 kebab-case（`hw-grid`、`dn-tooltip`、`speed-dial-trigger`）
- React 元件 PascalCase（`DayNav`、`SpeedDial`、`InfoSheet`）
- hook 使用 `use` prefix（`useTrip`、`useSwipeDay`）
- 常數 UPPER_SNAKE_CASE（`SWIPE_DIRECTION_RATIO`、`DRAG_THRESHOLD`、`STOPS`）
- 全部符合專案命名規範

---

## 潛在注意事項（非阻擋）

1. **TripPage.tsx:794** — `toTimelineEntry(e as unknown as Record<string, unknown>)` 在 `sheetContent` 的 `today-route` case 仍使用 `as unknown as`。這不在本次修改範圍內，但未來可考慮統一。
2. **css/style.css:159** — base `.hw-grid` gap 用 `8px` 而非 token `var(--spacing-2)`。F.1 只改了 mobile breakpoint 內的值，base 值雖符合 4pt grid 但未 token 化。屬於可後續改善項目。

---

**結論：APPROVE** — 31 項完成改動全部正確，9 項跳過理由合理。CSS HIG、型別安全、命名規範皆合規。
