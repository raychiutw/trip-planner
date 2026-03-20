# UX 全面升級 + 6 套主題配色

## 動機

目前行程頁存在 10 個 UX 痛點（Day Header 層級混亂、SpeedDial 過度分層、天氣過載、餐廳像試算表、InfoPanel 空虛、地圖散佈、主題沒個性、Day Nav 盲選、缺乏「此刻」引導、缺乏手勢），同時主題僅 3 套（sun/sky/zen），使用者選擇有限。

## 目標

1. **主題擴充 3 → 6**：新增 Forest（森林綠）、Sakura（櫻花粉）、Ocean（深海藍），各含 light/dark 模式
2. **10 項 UX 改善**全部實作，所有顏色透過 CSS custom property token 系統
3. **DayNav 完整版設計**：顯示日期 + tooltip 摘要 + 長行程分群

## 變更範圍

### CSS
- `css/shared.css`：新增 3 套主題的 `body.theme-{name}` + `body.theme-{name}.dark` token 定義，以及主題個性化 token（`--theme-header-gradient`、`--theme-font-weight-headline`、`--theme-line-height-body`）
- `css/style.css`：Day Header 邊條、餐廳 mini card、天氣簡化佈局、DayNav tooltip、此刻高亮、展開動畫、手勢回饋

### React 組件
- `src/hooks/useDarkMode.ts`：擴充 `ColorTheme` 聯合型別為 6 種
- `src/pages/SettingPage.tsx`：擴充 `COLOR_THEMES` + `THEME_ACCENTS`
- `src/components/trip/DayNav.tsx`：完整版設計（日期顯示 + tooltip + 長行程分群）
- `src/components/trip/SpeedDial.tsx`：扁平化 2×3 grid + 新增「今日路線」入口
- `src/components/trip/HourlyWeather.tsx`：簡化 3 層結構、移除 location badge
- `src/components/trip/Restaurant.tsx`：mini card 重設計
- `src/components/trip/InfoPanel.tsx`：加入今日摘要 + 天氣概覽 + 快速連結
- `src/components/trip/TimelineEvent.tsx`：此刻高亮 + 過去降 opacity
- `src/components/trip/Timeline.tsx`：傳入當前時間供此刻判斷
- `src/hooks/useSwipeDay.ts`：新增，swipe 切天手勢 hook
- `src/components/trip/TodayRouteSheet.tsx`：新增，今日路線 bottom sheet

### 連動影響
- 無 API 變更，純前端 UI/UX
- 無資料結構變更
- 需更新 `useDarkMode` 的 `THEME_CLASSES` 與 `THEME_COLORS`
- 設定頁 theme grid 從 3 欄變 2×3 或 3×2 佈局
