# Engineer I Report — InfoPanel + Features + ThemeArt

**Date**: 2026-03-20

---

## #1 ThemeArt 診斷

**結論：程式碼正確，非 code bug。**

分析 `ThemeArt.tsx` 中 `DayHeaderArt` (L343-344)：
- key 格式：`` `${theme}-${dark ? 'dark' : 'light'}` ``
- `ColorTheme` 型別（useDarkMode.ts L5）：`'sun' | 'sky' | 'zen' | 'forest' | 'sakura' | 'ocean'`
- content map 有 12 個 key，完全匹配 6 主題 x 2 模式

`useDarkMode` hook 回傳的 `colorTheme` 值是 `'sun'`、`'sky'` 等（不是 `'theme-sun'`），與 ThemeArt 的 key 匹配。body class 是 `'theme-sun'` 但那只用於 CSS，不影響 ThemeArt 的 JSX lookup。

**根因推測**：build 產物過時或 worktree 未合併。重新 deploy 應可解決。

---

## #16 InfoPanel 移除 QuickLinks

**已完成。**

變更：
- `src/components/trip/InfoPanel.tsx`：移除 QuickLinks import 和渲染，移除 `onQuickAction` prop
- `src/components/trip/QuickLinks.tsx`：刪除整個檔案
- `css/style.css`：移除 `.quick-links-row`、`.quick-link-btn`、`.quick-link-btn:hover`、`.quick-link-btn .svg-icon`、`.quick-link-label` 共 5 條 CSS 規則
- `src/pages/TripPage.tsx`：移除 InfoPanel 的 `onQuickAction` prop 傳遞

---

## #17 今日行程 onClick → scrollIntoView

**已完成。**

變更：
- `src/components/trip/TimelineEvent.tsx`：`.tl-event` 加上 `data-entry-index={index - 1}` 屬性
- `src/components/trip/InfoPanel.tsx`：新增 `handleEntryClick` callback，用 `document.querySelector('.tl-event[data-entry-index="N"]')` 找到對應 DOM 元素，呼叫 `scrollIntoView({ behavior: 'smooth', block: 'center' })`
- `src/components/trip/TodaySummary.tsx`：已有 `onEntryClick` prop 支援，直接傳入 `handleEntryClick`

---

## #18 旅行當天自動定位

**已完成（含 Challenger 時區修正）。**

變更：
- `src/pages/TripPage.tsx`：
  1. 新增 `TRIP_TIMEZONE` mapping（okinawa/kyoto → Asia/Tokyo、busan → Asia/Seoul、banqiao → Asia/Taipei）
  2. 新增 `getLocalToday(tripId)` helper，使用 `Intl.DateTimeFormat('sv-SE', { timeZone })` 取得目的地當地日期
  3. `todayDayNum` 改用 `getLocalToday(activeTripId)`（不再用 UTC `toISOString()`）
  4. auto-scroll useEffect 同樣改用 `getLocalToday(activeTripId)`
  5. URL hash 優先：有 `#dayN` 時不覆蓋
  6. auto-scroll 後 300ms 延遲 scrollIntoView `.tl-now`（含 null check）

---

## #19 交通統計重設計

**已完成。**

### formatUtils.ts 時間格式
- `>=1h`：`XhYYm`（如 `2h05m`）
- `<1h`：`YYm`（如 `30m`）
- `0`：`—`

### DrivingStats.tsx 重設計
- **手機版 <768px**：每天一張 `.ds-card`，內含交通類型垂直排列（icon + label + 時間）
- **桌面版 >=768px**：`.ds-table` 表格，欄位為各交通類型，底部合計列
- **開車 >2h 警告**：`.ds-cell-warn`（color: var(--color-warning)）+ warning icon
- **卡片警告**：`.ds-card-warn`（background: var(--color-warning-bg)）
- **合計列警告**：`.ds-row-warn`（background: var(--color-warning-bg)）

### CSS 新增
- `.ds-cards`、`.ds-card`、`.ds-card-warn`、`.ds-card-label`、`.ds-card-row`、`.ds-card-type`
- `.ds-cell-value`、`.ds-cell-warn`
- `.ds-table-wrap`、`.ds-table`、`.ds-table-label`、`.ds-row-warn`
- `@media (min-width: 768px)` 負責 cards/table 切換

---

## #21 倒數天數簡化

**已完成。**

變更：
- `src/components/trip/Countdown.tsx`：
  - 出發前：顯示 `<span class="countdown-num">131</span><span class="countdown-unit">天</span>`
  - 旅行中：顯示 `Day N` + 「旅行進行中」
  - 旅行後：plane icon + 「旅程已結束」
  - 移除 `dateDisplay`（不再顯示日期）
- `css/style.css`：
  - `.countdown-number`：改為 flex baseline 排列
  - `.countdown-num`：`font-size: var(--font-size-title2)`
  - `.countdown-unit`：`font-size: var(--font-size-body); font-weight: 600`
  - 移除 `.countdown-date` 規則

注意：Challenger 指出沒有 `--font-size-title1` token，改用 `--font-size-title2`（1.375rem），符合現有 design tokens。

---

## 測試結果

- TypeScript：無新增錯誤（僅 pre-existing clsx 型別宣告警告）
- 測試：440/440 通過（含 CSS HIG compliance）
