## 1. 全域 :active 按壓效果

- [x] 1.1 在 `css/shared.css` 加入全域 `:active` 效果（scale + opacity）+ `-webkit-tap-highlight-color: transparent`

## 2. Large Title 捲動收合

- [x] 2.1 在 `src/pages/TripPage.tsx` 加入 Large Title 區域（行程名 + 日期範圍）
- [x] 2.2 用 IntersectionObserver 偵測 large title 可見性，控制 StickyNav 的 inline title 顯示
- [x] 2.3 在 `css/style.css` 加入 large-title + inline-title 的樣式和 fade 動畫

## 3. 卡片 Elevation 體系

- [x] 3.1 在 `css/style.css` 加入 `.tl-card`（輕 shadow）、`.tl-now .tl-card`（強 shadow + accent）、`.tl-past .tl-card`（無 shadow + 淡化）樣式

## 4. DayNav Sliding Indicator

- [x] 4.1 在 `src/components/trip/DayNav.tsx` 新增 sliding indicator `<div>`，用 ref 計算 active pill 的位置
- [x] 4.2 在 `css/style.css` 加入 sliding indicator 的樣式和 spring transition

## 5. Day 切換 Crossfade

- [x] 5.1 在 `css/style.css` 新增 `@keyframes fadeSlideIn` 動畫
- [x] 5.2 在 `src/pages/TripPage.tsx` 的 DaySection 加入 key={currentDayNum} 觸發進場動畫

## 6. 自動導航至今天

- [x] 6.1 在 `src/pages/TripPage.tsx` 的初始載入邏輯中，當 localToday 在行程範圍內時自動 switchDay(todayDayNum)
- [x] 6.2 自動 scrollIntoView 到 tl-now 事件

## 7. 測試

- [x] 7.1 執行 `npx tsc --noEmit` + `npm test` 確認全過
