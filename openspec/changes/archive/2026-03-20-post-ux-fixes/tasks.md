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

- [x] C.1 ThemeArt Forest SVG（Header/Divider/Footer × light/dark）
- [x] C.2 ThemeArt Sakura SVG
- [x] C.3 ThemeArt Ocean SVG
- [x] C.4 InfoSheet 高度依內容 max 85%（min(fit-content, 85dvh) + px 步進）
- [x] C.5 InfoSheet body scroll lock（iOS Safari position:fixed 方案）
- [x] C.6 InfoSheet 手勢整合（到頂→縮小，到底→放大已移除）

## Group D — 低優先

- [x] D.1 Sticky nav 不透明度 85%→92% + box-shadow 分隔
- [x] D.2 Sentry CSP connect-src 加 https://*.ingest.us.sentry.io（4 個 HTML）

## Group E — 預存問題（HIGH）

- [x] E.1 css/style.css:33 — .sticky-nav 移除 border-bottom，改用背景色區分
- [x] E.2 css/style.css:371-407 — print mode 移除所有 border: 1px solid
- [x] E.3 useTrip.ts:14 — mapDayResponse 改為欄位逐一映射
- [x] E.4 InfoSheet.tsx:212-213 — 拆為 preventTouchScroll + preventWheelScroll
- [x] E.5 useSwipeDay.ts:21 — 確認無 dep array 是正確做法（跳過）
- [x] E.6 drivingStats.ts:66 — typeof guard 取代 as unknown

## Group F — 預存問題（MEDIUM）

- [x] F.1 css/style.css:425 — .hw-grid gap → var(--spacing-1)
- [x] F.2 DayNav.tsx — tooltip 加 aria-describedby
- [x] F.3 SpeedDial.tsx:132 — hardcoded SVG → Icon 元件
- [x] F.4 SpeedDial.tsx:127 — trigger 加 aria-controls
- [x] F.5 useTrip.ts — 補齊 updated_at fallback 映射
- [x] F.6 useTrip.ts:66 — catch 加 console.warn
- [x] F.7 DayNav.tsx:82 — 確認已正確（跳過）
- [x] F.8 DayNav.tsx:103 — 確認已正確（跳過）
- [x] F.9 InfoSheet.tsx:102 — classList 加註釋說明
- [x] F.10 drivingStats.ts:70 — 加 null guard
- [x] F.11 drivingStats.ts:104-109 — 確認已正確（跳過）
- [x] F.12 TripPage.tsx:100 — weather_json type guard
- [x] F.13 TripPage.tsx:153 — toHotelData type guard
- [x] F.14 TripPage.tsx:160 — toTimelineEntry type guard
- [x] F.15 TripPage.tsx:417-418 — travel/travel_type type guard
- [x] F.16 useSwipeDay.ts:52 — SWIPE_DIRECTION_RATIO 常數

## Group G — 預存問題（LOW）

- [x] G.1 useTrip.ts:164-171 — 確認已有 try-catch（跳過）
- [x] G.2 DayNav.tsx:48 — 確認型別一致（跳過）
- [x] G.3 SpeedDial.tsx:106 — backdrop 加用途註釋
- [x] G.4 TripPage.tsx:305-311 — RawDay 拆為 3 個具體型別
- [x] G.5 TripPage.tsx:837 — 移除未使用依賴
- [x] G.6 InfoSheet.tsx:60 — 確認已有 optional chaining（跳過）
- [x] G.7 useSwipeDay.ts:65-66 — passive listener 加註釋
- [x] G.8 css/style.css:192 — 確認非 token 範疇（跳過）
