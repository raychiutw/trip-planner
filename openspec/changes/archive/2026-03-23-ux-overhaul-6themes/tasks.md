# UX 全面升級 + 6 套主題配色 — 任務清單

## 1. 主題系統擴充（3 → 6 套）

### 1.1 擴充 useDarkMode hook
- [x] 1.1.1 修改 `src/hooks/useDarkMode.ts`：`ColorTheme` 型別新增 `'forest' | 'sakura' | 'ocean'`
- [x] 1.1.2 `THEME_CLASSES` 新增 `'theme-forest'`, `'theme-sakura'`, `'theme-ocean'`
- [x] 1.1.3 `THEME_COLORS` 新增三套主題的 `{ light, dark }` 值
- [x] 1.1.4 `readColorTheme()` 驗證函式新增三個合法值

### 1.2 新增 3 套主題 CSS token
- [x] 1.2.1 `css/shared.css`：新增 `body.theme-forest` light token 定義（含所有 --color-*、--shadow-*、--scrollbar-*、--cmp-*）
- [x] 1.2.2 `css/shared.css`：新增 `body.theme-forest.dark` dark token 定義
- [x] 1.2.3 `css/shared.css`：新增 `body.theme-sakura` light token 定義
- [x] 1.2.4 `css/shared.css`：新增 `body.theme-sakura.dark` dark token 定義
- [x] 1.2.5 `css/shared.css`：新增 `body.theme-ocean` light token 定義
- [x] 1.2.6 `css/shared.css`：新增 `body.theme-ocean.dark` dark token 定義

### 1.3 主題個性化 token
- [x] 1.3.1 `css/shared.css` `:root` 新增 `--theme-header-gradient`、`--theme-font-weight-headline`、`--theme-line-height-body`、`--theme-section-gap` 預設值
- [x] 1.3.2 各主題 override 個性化 token：Sky 漸層、Zen 降字重+加行距、Forest 斜角漸層、Sakura 粉漸層、Ocean 藍漸層

### 1.4 設定頁擴充
- [x] 1.4.1 `src/pages/SettingPage.tsx`：`COLOR_THEMES` 新增 forest/sakura/ocean 三項
- [x] 1.4.2 `src/pages/SettingPage.tsx`：`THEME_ACCENTS` 新增三套主題色
- [x] 1.4.3 `css/setting.css`：`.color-theme-grid` 調整為 3 欄 grid（桌面 3×2、手機 2×3）

### 1.5 單元測試
- [ ] 1.5.1 更新 useDarkMode 相關測試，驗證 6 套主題切換（待 Task 12 統一執行）

## 2. Day Header 視覺層級（#1）

- [x] 2.1 `css/style.css`：`.day-header` 新增 `border-left: 4px solid var(--color-accent)` + `background: var(--color-accent-subtle)` + `background-image: var(--theme-header-gradient)`
- [x] 2.2 `css/style.css`：`body.dark .day-header` 改用 `--color-accent-bg` 底色

## 3. SpeedDial 扁平化（#2）

- [x] 3.1 `src/components/trip/SpeedDial.tsx`：`DIAL_ITEMS` 改為 8 個扁平直達按鈕（flights, checklist, emergency, backup, suggestions, today-route, driving, tools）
- [x] 3.2 `src/components/trip/SpeedDial.tsx`：新增每個 item 的 `action` 欄位（`'sheet' | 'navigate' | 'group'`）
- [x] 3.3 `src/components/trip/SpeedDial.tsx`：`handleItemClick` 根據 action 直接觸發，移除 group 中間層邏輯（tools 保留 group）
- [x] 3.4 `css/style.css`：`.speed-dial-items` 改為 grid 佈局（`grid-template-columns: repeat(auto-fill, minmax(64px, 1fr))`）
- [x] 3.5 更新 SpeedDial 呼叫方的 prop 傳遞（TripPage.tsx），確保 `today-route` action 正確觸發 TodayRouteSheet

## 4. 天氣方塊簡化（#3）

- [x] 4.1 `src/components/trip/HourlyWeather.tsx`：移除 `hw-block-loc` location badge 渲染
- [x] 4.2 `src/components/trip/HourlyWeather.tsx`：每格改為 3 層（時間 → icon+溫度同行 → 降雨%）
- [x] 4.3 `css/style.css`：`.hw-block` 寬度從 60px 減為 52px
- [x] 4.4 `css/style.css`：`.hw-rain-high` 格加 `background: var(--color-info-bg)` 底色
- [ ] 4.5 更新 HourlyWeather 單元測試

## 5. 餐廳 Mini Card（#4）

- [x] 5.1 `src/components/trip/Restaurant.tsx`：重構渲染結構為 mini card 佈局（accent 邊條 + 名稱行 + meta 行 + 備註）
- [x] 5.2 `css/style.css`：`.restaurant-choice` 新增 accent-subtle 底色 + 左邊條 + 圓角 + padding
- [x] 5.3 `css/style.css`：`.restaurant-meta-row` flex 佈局（rating · price · hours 用分隔符）
- [x] 5.4 `src/components/trip/Restaurant.tsx`：MapLinks 移到名稱行右側（inline）
- [ ] 5.5 更新 Restaurant 單元測試

## 6. Desktop InfoPanel 充實（#5）

- [x] 6.1 新增 `src/components/trip/TodaySummary.tsx`：顯示當天景點清單（name + time），點擊可跳轉
- [x] 6.2 新增 `src/components/trip/QuickLinks.tsx`：icon button row（航班、緊急聯絡、備案、今日路線）
- [x] 6.3 `src/components/trip/InfoPanel.tsx`：引入 TodaySummary + QuickLinks，接收 `currentDay` + `onQuickAction` props
- [x] 6.4 `src/pages/TripPage.tsx`：傳遞 `currentDay` + `onQuickAction` 到 InfoPanel
- [x] 6.5 `css/style.css`：InfoPanel 內新組件樣式（摘要列表、icon button row）

## 7. 今日地圖總覽（#6）

- [x] 7.1 新增 `src/components/trip/TodayRouteSheet.tsx`：顯示當天所有景點 + 地圖連結列表
- [x] 7.2 在 TripPage.tsx 中整合 TodayRouteSheet（透過 InfoSheet 機制或獨立 bottom sheet）
- [x] 7.3 SpeedDial 的 `today-route` 按鈕點擊觸發 TodayRouteSheet
- [x] 7.4 InfoPanel QuickLinks 的「今日路線」按鈕觸發同一 sheet

## 8. DayNav 完整版設計（#8）

### 8.1 Pill 日期顯示
- [x] 8.1.1 `src/components/trip/DayNav.tsx`：新增 `formatPillLabel()` 函式（MM/DD + 星期縮寫，>10天省略星期）
- [x] 8.1.2 `src/components/trip/DayNav.tsx`：pill 文字從 `{dayNum}` 改為 `formatPillLabel(day, totalDays)`
- [x] 8.1.3 `css/style.css`：`.dn` pill 寬度從固定改為 `min-width` + padding 適應較長文字

### 8.2 今日標記
- [x] 8.2.1 `src/components/trip/DayNav.tsx`：新增 `todayDayNum` prop
- [x] 8.2.2 `src/components/trip/DayNav.tsx`：今日 pill 加 `.dn-today` class
- [x] 8.2.3 `css/style.css`：`.dn-today::after` 偽元素渲染底部小圓點（accent 色）
- [x] 8.2.4 `src/pages/TripPage.tsx`：計算 todayDayNum 並傳入 DayNav

### 8.3 Tooltip
- [x] 8.3.1 `src/components/trip/DayNav.tsx`：新增 tooltip state（hoveredDay / longPressDay）
- [x] 8.3.2 Desktop：`onMouseEnter` / `onMouseLeave` 顯示/隱藏 tooltip
- [x] 8.3.3 Mobile：`onTouchStart` 開始 500ms 計時器，`onTouchEnd` 清除，達到 500ms 顯示 tooltip
- [x] 8.3.4 Tooltip 內容：`Day {n} — {date}（{weekday}）\n{label}`
- [x] 8.3.5 `css/style.css`：`.dn-tooltip` absolute 定位 + 動畫（opacity + translateY）

### 8.4 單元測試
- [ ] 8.4.1 測試 `formatPillLabel` 的日期格式化
- [ ] 8.4.2 測試 >10 天省略星期的邏輯
- [ ] 8.4.3 測試 todayDayNum 標記

## 9. 「此刻」引導（#9）

- [x] 9.1 `src/components/trip/TimelineEvent.tsx`：新增 `isNow` + `isPast` props，加 `.tl-now` / `.tl-past` class
- [x] 9.2 `src/components/trip/Timeline.tsx`：計算當前時間並比對 entry.time，傳入 isNow/isPast
- [x] 9.3 `css/style.css`：`.tl-now` 的 accent 高亮 + shadow-ring + pulse 動畫
- [x] 9.4 `css/style.css`：`.tl-past` 的 opacity 降低（0.55）
- [x] 9.5 `css/style.css`：`@keyframes pulse` 動畫定義
- [x] 9.6 Timeline 僅在 `day.date === today` 時啟用此刻判斷

## 10. 手勢操作（#10）

### 10.1 P0 — Swipe 切天
- [x] 10.1.1 新增 `src/hooks/useSwipeDay.ts`：touch event 偵測水平滑動 hook
- [x] 10.1.2 在 TripPage.tsx 的 day content 容器掛載 useSwipeDay
- [x] 10.1.3 swipe 觸發 `switchDay(currentDayNum ± 1)` 並加入邊界檢查

### 10.2 P1 — 展開收合動畫
- [x] 10.2.1 `css/style.css`：`.tl-body` 改用 `grid-template-rows: 0fr → 1fr` 動畫
- [x] 10.2.2 確認 `.expanded` class toggle 邏輯與動畫相容

### 10.3 P2 — Bottom Sheet 慣性
- [x] 10.3.1 修改 InfoSheet 的 `touchend` 判斷：加入速度計算（最後 100ms 位移/時間）
- [x] 10.3.2 速度 > 0.5px/ms 按方向 snap，否則按位置 snap

## 11. Icon 註冊

- [x] 11.1 `src/components/shared/Icon.tsx`：ICONS registry 新增 `route` icon（地圖路線 SVG）

## 12. Build + 測試驗證

- [ ] 12.1 `npx tsc --noEmit` 通過，無 TypeScript 錯誤
- [ ] 12.2 `npm test` 通過（naming-convention + css-hig + unit + integration）
- [ ] 12.3 確認 6 套主題 × light/dark 切換正常
- [ ] 12.4 確認手機/桌面斷點佈局正確
