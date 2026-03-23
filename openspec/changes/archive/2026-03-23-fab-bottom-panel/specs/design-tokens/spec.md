## ADDED Requirements

### Requirement: night 主題 token 加入 shared.css
系統 SHALL 在 `css/shared.css` 中新增 `.theme-night` 和 `.theme-night.dark` 兩個選擇器區塊，定義 night 主題的完整色彩 token（詳見 night-theme spec）。

#### Scenario: .theme-night 選擇器存在
- **WHEN** 靜態分析 `css/shared.css`
- **THEN** SHALL 存在 `.theme-night` 和 `.theme-night.dark` 選擇器，各包含完整的色彩變數定義

## REMOVED Requirements

### Requirement: ocean 主題 token
**Reason**: ocean（深藍）與 sky（天藍）色相太近，使用者難以區分。替換為 night（黑色系）。
**Migration**: `.theme-ocean` 相關 CSS 全部刪除，JS 中 `'ocean'` 自動映射為 `'night'`。

## ADDED Requirements

### Requirement: 停車場地圖連結 fallback
`mapDay.ts` 的 `buildLocation()` 函式 SHALL 在 `maps` 參數不是有效 URL 時，將 `maps` 值作為 `name` 欄位（用於 Google Maps 搜尋 fallback），而非將 `name` 留空。

#### Scenario: 停車場地名生成正確搜尋連結
- **WHEN** `buildLocation` 接收 `maps="北谷町営駐車場 美浜"` 且無 `name`
- **THEN** 回傳的 `NavLocation.name` SHALL 為 `"北谷町営駐車場 美浜"`，`googleQuery` SHALL 為 `undefined`
- **AND** `resolveGoogleUrl` 最終生成 `https://maps.google.com/?q=北谷町営駐車場%20美浜`

#### Scenario: 正常 URL 不受影響
- **WHEN** `buildLocation` 接收 `maps="https://maps.google.com/?q=xxx"`
- **THEN** 回傳的 `googleQuery` SHALL 為該 URL，行為不變

### Requirement: URL trip 參數優先於 localStorage
`TripPage.tsx` 的 trip resolve 邏輯 SHALL 確保 URL `?trip=` 參數永遠優先於 localStorage `trip-pref`。僅當 URL 無 trip 參數時才 fallback 到 localStorage。

#### Scenario: URL 有 trip 參數時直接使用
- **WHEN** URL 為 `/?trip=busan-trip-2026-CeliaDemyKathy` 且 localStorage 有 `trip-pref=okinawa-trip-2026-Ray`
- **THEN** 系統 SHALL 載入 busan 行程，不使用 localStorage 的值

#### Scenario: URL 無 trip 參數時 fallback localStorage
- **WHEN** URL 為 `/` 且 localStorage 有 `trip-pref=okinawa-trip-2026-Ray`
- **THEN** 系統 SHALL 載入 okinawa 行程

### Requirement: 預約連結觸控目標 ≥ 44px
餐廳/活動的外部預約連結（reservation URL）SHALL 有最小觸控高度 `var(--tap-min)`（44px）。

#### Scenario: 預約連結高度足夠
- **WHEN** 在 390px 手機 viewport 測量預約連結元素
- **THEN** 高度 SHALL ≥ 44px
