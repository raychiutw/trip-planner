## Context

多項小改動累積出原生 App 感。涵蓋觸覺回饋、排版、視覺層次、導覽動效、智慧導航。

## Goals / Non-Goals

**Goals:**
- 全域 :active 按壓效果
- Large Title + 捲動收合
- 卡片 Elevation 三層體系
- DayNav sliding indicator
- Day 切換 crossfade 動畫
- 自動導航至今天

**Non-Goals:**
- 不做左右滑動切天（Key User 排除）
- 不做出發提醒（Key User 排除）
- 不做底部 Tab Bar（移至後續）

## Decisions

### D1. 全域 :active 按壓
```css
.dn:active, .quick-panel-item:active, .map-link:active,
.tl-card:active, .col-row:active, .nav-back-btn:active,
.edit-fab:active, .quick-panel-trigger:active {
  transform: scale(0.97);
  opacity: 0.7;
  transition: transform 80ms, opacity 80ms;
}
```
加上 `-webkit-tap-highlight-color: transparent` 消除預設 tap highlight。

### D2. Large Title
在 TripPage 的 trip content 頂部加入 large title 區域（行程名 + 日期範圍），使用 IntersectionObserver 偵測可見性。當 large title 離開視窗，StickyNav 顯示 inline title（fade-in）。

### D3. 卡片 Elevation
三層體系：
- `.tl-past .tl-card`: 無 shadow, 70% opacity background
- `.tl-card`（一般）: `box-shadow: 0 1px 3px rgba(0,0,0,0.06)`
- `.tl-now .tl-card`: `box-shadow: 0 4px 12px rgba(0,0,0,0.10)` + accent border

### D4. DayNav Sliding Indicator
用一個 absolute positioned `<div>` 作為背景 capsule，透過 ref 取得 active pill 的 `offsetLeft` + `offsetWidth`，用 `transform: translateX()` + spring easing 動畫。

### D5. Day Crossfade
每次 `currentDayNum` 變化時，`day-content` 區域套用 `@keyframes fadeSlideIn { from { opacity: 0; translateY(12px) } to { opacity: 1; translateY(0) } }` 動畫，300ms duration。

### D6. 自動導航至今天
在 TripPage 初始載入時，如果 `localToday` 在行程日期範圍內，自動 `switchDay(todayDayNum)` + 對 `tl-now` 事件 `scrollIntoView`。

## Risks / Trade-offs

- **[Risk] Large Title + IntersectionObserver 在捲動密集時效能** → Mitigation：使用 `threshold: [0]` 只偵測進出，不做連續計算
- **[Risk] DayNav indicator 在 pill 數量變化時需要重新計算** → Mitigation：useLayoutEffect + ResizeObserver
