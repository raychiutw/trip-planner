# R3 工程師報告

## 結果

- `npx tsc --noEmit` — 0 errors
- `npm test` — 440 passed, 0 failed

## 各任務詳情

### R3-10 SpeedDial grid 向左擴展
- `.speed-dial-items`: `right: 0` → `right: -8px`，加 `column-gap: 72px`
- 讓兩欄之間有足夠間距，右欄 label 不再覆蓋左欄 icon

### R3-11 SpeedDial label pill 樣式
- `border-radius: var(--radius-sm)` → `var(--radius-full)`
- `padding: 4px 8px` → `4px 12px`（原需求 10px 不在 4pt grid 上，修正為 12px）
- `box-shadow: var(--shadow-md)` + `background: var(--color-secondary)` 已原本存在

### R3-2 設定頁 ← 移除
- SettingPage.tsx 移除 `nav-back-btn`（line 140-149，僅在 `section` 參數存在時顯示）
- CSS `.nav-back-btn` 保留在 shared.css（通用元件，其他頁面可能使用）

### R3-3 DayNav active label 移除
- DayNav.tsx: 移除 `.dn-active-label` 的 JSX（198-200 行）
- style.css: 移除整個 `/* ===== DayNav Active Label ===== */` 區塊（117-129 行）
- style.css: `.dh-nav-wrap` 移除 `padding-bottom: 20px`

### R3-4 InfoPanel 倒數天數移除
- InfoPanel.tsx: 移除 `Countdown` import 和 `<Countdown>` 渲染
- 移除 `autoScrollDates` prop

### R3-5 InfoPanel 車程統計移除
- InfoPanel.tsx: 移除 `TripStatsCard` import 和渲染
- TripPage.tsx: 移除 `autoScrollDates` prop 傳遞

### R3-1 Bottom Sheet X 統一
- `.sheet-close-btn` 已使用 `var(--tap-min)` (44px)
- `.nav-close-btn` 同樣使用 `var(--tap-min)` (44px)
- 確認全站一致，no-op

### R3-6 InfoPanel 寬度加大
- shared.css: `--info-panel-w: 280px` → `350px`（+70px）

### R3-7 TodaySummary 加地圖連結
- TodaySummary.tsx: 每個項目後加 Google Maps (G) + Naver Map (N) 圖示連結
- 新增 CSS: `.today-summary-links`, `.today-summary-map-link`
- 從 `entry.maps` 建構 Google URL，從 `entry.location.naverQuery` 建構 Naver URL
- 點擊地圖連結不觸發 `onEntryClick`（`stopPropagation`）

### R3-8 InfoPanel 加飯店 + 當日交通
- InfoPanel.tsx 新增:
  - `.hotel-summary-card`: 顯示 `currentDay.hotel.name` + `checkout` 時間
  - `.transport-summary-card`: 用 `calcDrivingStats()` 計算當日交通，按類型列出
- 新增 CSS: `.hotel-summary-name`, `.hotel-summary-checkout`, `.transport-summary-row` 等

### R3-9 hover padding 加大
- `.col-row`: `padding: var(--spacing-1) var(--spacing-2)` → `var(--spacing-2) var(--spacing-3)`，`margin` 同步調整
- `.hw-summary`: 同上
- `.today-summary-item`: 同上

### R3-12 QC prompt 加強
- prompt-template.md QC 區段加入第一原則：「截圖視覺驗證優先，DOM 檢查輔助。不能只靠 DOM 判 PASS」

## 變更檔案清單

| 檔案 | 變更類型 |
|------|---------|
| css/style.css | 修改（R3-3, R3-9, R3-10, R3-11, R3-7, R3-8） |
| css/shared.css | 修改（R3-6） |
| src/components/trip/InfoPanel.tsx | 重寫（R3-4, R3-5, R3-8） |
| src/components/trip/DayNav.tsx | 修改（R3-3） |
| src/components/trip/TodaySummary.tsx | 重寫（R3-7） |
| src/pages/SettingPage.tsx | 修改（R3-2） |
| src/pages/TripPage.tsx | 修改（R3-4, R3-5） |
| .claude/skills/tp-team/references/prompt-template.md | 修改（R3-12） |
