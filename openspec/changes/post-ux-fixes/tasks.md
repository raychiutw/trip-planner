# UX 大改版後修復 — 任務清單

## Group A — 快速修

- [x] A.1 移除 .day-header border-left（css/style.css）
- [x] A.2 移除 .restaurant-choice border-left（css/style.css）
- [x] A.3 檢查 .hotel-sub border-left 並移除
- [x] A.4 footer 加 safe-area-inset-bottom（css/style.css）
- [x] A.5 DayNav formatPillLabel 移除星期（DayNav.tsx）
- [x] A.6 修復交通統計 Day undefined（DrivingStats 相關元件）

## Group B — 中等

- [x] B.1 SpeedDial flex → grid 2 欄（css/style.css）
- [x] B.2 SpeedDial label 改到 icon 下方（SpeedDial.tsx + css）
- [x] B.3 SpeedDial staggered animation 調整
- [x] B.4 useSwipeDay 用 useRef 修 closure bug（useSwipeDay.ts）
- [x] B.5 InfoSheet 加 .dragging class toggle（InfoSheet.tsx）
- [x] B.6 DayNav active pill 常駐 label（DayNav.tsx + css）

## Group C — 大型

- [ ] C.1 ThemeArt Forest SVG（Header/Divider/Footer × light/dark）
- [ ] C.2 ThemeArt Sakura SVG
- [ ] C.3 ThemeArt Ocean SVG
- [ ] C.4 InfoSheet 高度依內容 max 85%
- [ ] C.5 InfoSheet body scroll lock
- [ ] C.6 InfoSheet 手勢整合（內容到頂→縮小 panel，到底→放大 panel）

## Group D — 低優先

- [ ] D.1 Sticky nav 提高背景不透明度（需實機驗證）
- [ ] D.2 Sentry CSP connect-src 加 ingest domain

## Group E — 預存問題（HIGH）

- [ ] E.1 css/style.css:33 — .sticky-nav 移除 border-bottom，改用背景色區分
- [ ] E.2 css/style.css:371-407 — print mode 移除所有 border: 1px solid
- [ ] E.3 useTrip.ts:14 — mapDayResponse 的 `as unknown as Day` 改為欄位逐一映射
- [ ] E.4 InfoSheet.tsx:212-213 — 移除 `as unknown as` 雙重轉型，用正確的 React event handler 型別
- [ ] E.5 useSwipeDay.ts:21 — ref 更新 effect 加空 dependency array `[]`
- [ ] E.6 drivingStats.ts:66 — `as unknown as string` 改用 typeof guard

## Group F — 預存問題（MEDIUM）

- [ ] F.1 css/style.css:425 — .hw-grid hardcoded gap: 4px → var(--spacing-1)
- [ ] F.2 DayNav.tsx — tooltip 加 aria-describedby 連結
- [ ] F.3 SpeedDial.tsx:132 — hardcoded SVG → Icon 元件
- [ ] F.4 SpeedDial.tsx:127 — trigger 加 aria-controls="speedDialItems"
- [ ] F.5 useTrip.ts — 檢查並映射所有 snake_case API 欄位
- [ ] F.6 useTrip.ts:66 — silent error catch 加 console.warn
- [ ] F.7 DayNav.tsx:82 — scroll listener cleanup 在 ResizeObserver 失敗時也要移除
- [ ] F.8 DayNav.tsx:103 — scrollPillIntoView 加 null check
- [ ] F.9 InfoSheet.tsx:102 — classList DOM 操作加註釋說明 React 外操作原因
- [ ] F.10 drivingStats.ts:70 — regex match null guard
- [ ] F.11 drivingStats.ts:104-109 — DayLike optional fields 加 null check
- [ ] F.12 TripPage.tsx:100 — weather_json 取值用 type guard 取代 as unknown
- [ ] F.13 TripPage.tsx:153 — toHotelData 取值用 type guard
- [ ] F.14 TripPage.tsx:160 — toTimelineEntry 取值用 type guard
- [ ] F.15 TripPage.tsx:417-418 — travel/travel_type 取值用 type guard
- [ ] F.16 useSwipeDay.ts:52 — magic number 1.2 抽為常數 SWIPE_DIRECTION_RATIO

## Group G — 預存問題（LOW）

- [ ] G.1 useTrip.ts:164-171 — doc content JSON.parse 加 try-catch
- [ ] G.2 DayNav.tsx:48 — longPressTimer 型別一致性
- [ ] G.3 SpeedDial.tsx:106 — backdrop scroll prevention 評估改進
- [ ] G.4 TripPage.tsx:305-311 — RawDay 型別收窄
- [ ] G.5 TripPage.tsx:837 — 移除未使用的 handleDownloadOpen 依賴
- [ ] G.6 InfoSheet.tsx:60 — focus management guard
- [ ] G.7 useSwipeDay.ts:65-66 — passive listener + touch-action CSS 評估
- [ ] G.8 css/style.css:192 — tl-flag clip-path hardcoded 改 token
