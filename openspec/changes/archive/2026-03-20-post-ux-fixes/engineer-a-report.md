# Engineer A 修改報告

## Group A — 快速修復（Task #1~#4）

| 任務 | 檔案 | 改動 |
|------|------|------|
| #1 移除卡片 border-left | `css/style.css` | 移除 `body:not(.dark) .day-header` 的 `border-left: 4px solid`、`.restaurant-choice` 的 `border-left: 3px solid`、`.hotel-sub` 的 `border-left: 3px solid` |
| #2 footer safe-area | `css/style.css` | `footer` 加 `padding-bottom: max(16px, env(safe-area-inset-bottom))` |
| #3 DayNav pill 移除星期幾 | `src/components/trip/DayNav.tsx` | `formatPillLabel` 移除 `totalDays` 參數與 `>10` 分支，統一回傳 `${mm}/${dd}`；移除元件內已無用的 `const totalDays = days.length` |
| #4 交通統計 Day undefined | `src/hooks/useTrip.ts` | 新增 `mapDayResponse()` 在存入 cache 前將 `day_num` → `dayNum`、`day_of_week` → `dayOfWeek`；兩處 fetch 都改用 mapDayResponse |

---

## Group E — HIGH 預存修復（Task #14）

| 問題 | 檔案 | 改動 |
|------|------|------|
| E.1 sticky-nav border-bottom | `css/style.css:33` | 移除 `border-bottom: 1px solid var(--color-border)`，改用 `background: color-mix(in srgb, var(--color-background) 85%, transparent)` + `backdrop-filter: blur(12px)` |
| E.2 print mode border | `css/style.css:371-372` | `.print-mode .tl-card, .print-mode .info-card` 移除 `border: 1px solid var(--color-border)`；`.print-mode .day-header` 移除 `border-bottom: 1px solid var(--color-border)` |
| E.3 mapDayResponse spread | `src/hooks/useTrip.ts` | 移除 `...(raw as unknown as Day)`，改為逐欄明確映射（`id`, `dayNum`, `date`, `dayOfWeek`, `label`, `weather`, `updatedAt`, `hotel`, `timeline`） |
| E.4 preventScroll 型別 | `src/components/trip/InfoSheet.tsx` | 將 `preventScroll as unknown as React.TouchEventHandler/WheelEventHandler` 拆為 `preventTouchScroll(e: React.TouchEvent)` 和 `preventWheelScroll(e: React.WheelEvent)` 兩個正確型別的 handler |
| E.5 useSwipeDay dep array | `src/hooks/useSwipeDay.ts` | 確認現有寫法正確（無 dep array = 每次 render 更新 ref），無需修改 |
| E.6 drivingStats as unknown | `src/lib/drivingStats.ts:66` | `typeof t === 'string' ? (t as unknown as string) : ''` → `typeof t === 'string' ? t : ''` |
