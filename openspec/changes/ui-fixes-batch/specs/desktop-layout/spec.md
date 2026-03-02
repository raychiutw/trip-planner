## MODIFIED Requirements

### Requirement: 漢堡選單修復

**問題**：sidebar collapsed 時，桌機縮小視窗寬度，漢堡選單不可按

**解法**：移除 sidebar collapsed 時在 sticky-nav 內顯示漢堡選單的規則。桌機版 sidebar toggle 按鈕已足夠作為展開入口。

#### Scenario: sidebar collapsed 時桌機 sticky-nav 無漢堡選單

- **WHEN** 桌機版（≥768px）sidebar 處於 collapsed 狀態
- **THEN** sticky-nav 內 SHALL NOT 顯示漢堡選單按鈕

## ADDED Requirements

### Requirement: edit/setting 頁桌機隱藏 sticky-nav

edit 頁和 setting 頁在桌機版（≥768px）SHALL 隱藏整個 `.sticky-nav` 元素。手機版（<768px）SHALL 保留 sticky-nav（含漢堡選單按鈕）。

#### Scenario: 桌機版 edit 頁無 sticky-nav

- **WHEN** 使用者在桌機版（≥768px）開啟 edit.html
- **THEN** `.sticky-nav` 元素 SHALL 為 `display: none`

#### Scenario: 桌機版 setting 頁無 sticky-nav

- **WHEN** 使用者在桌機版（≥768px）開啟 setting.html
- **THEN** `.sticky-nav` 元素 SHALL 為 `display: none`

#### Scenario: 手機版保留 sticky-nav

- **WHEN** 使用者在手機版（<768px）開啟 edit 或 setting 頁
- **THEN** `.sticky-nav` SHALL 正常顯示並包含漢堡選單按鈕

### Requirement: map-link 背景統一

所有 `.map-link` 元素（含 `.map-link.mapcode`）背景 SHALL 為透明。hover 時背景 SHALL 為 `#333`（亮色）/ `#5A5651`（深色），文字色 SHALL 為 `#fff`。

#### Scenario: map-link 預設狀態

- **WHEN** 頁面顯示 map-link 連結
- **THEN** 所有 `.map-link`（含 `.mapcode`）背景 SHALL 為 transparent

#### Scenario: map-link hover 亮色模式

- **WHEN** 亮色模式下使用者 hover map-link
- **THEN** 背景 SHALL 為 `#333`，文字色 SHALL 為 `#fff`

#### Scenario: map-link hover 深色模式

- **WHEN** 深色模式下使用者 hover map-link
- **THEN** 背景 SHALL 為 `#5A5651`，文字色 SHALL 為 `#fff`

### Requirement: timeline 圓點對齊

`.tl-event::before` 圓點 SHALL 精確對齊時間軸線，消除水平偏移。

#### Scenario: 圓點水平對齊

- **WHEN** 時間軸渲染完成
- **THEN** 橘色圓點中心 SHALL 與時間軸垂直線對齊，無 1px 偏移

### Requirement: 天氣收合排版優化

`.hw-summary` 的 `justify-content` SHALL 為 `flex-start`（取代 `space-between`），元素間距由 `gap` 控制。收合箭頭 SHALL 使用 `+`（收合狀態）和 `-`（展開狀態）取代 `▸`。

#### Scenario: 天氣收合時排版

- **WHEN** 天氣區塊處於收合狀態
- **THEN** 摘要資訊靠左排列，項目間距一致，箭頭顯示 `+`

#### Scenario: 天氣展開時排版

- **WHEN** 天氣區塊處於展開狀態
- **THEN** 箭頭顯示 `-`

### Requirement: hw-now 框線完整顯示

`.hw-grid` SHALL 加 `padding-top: 2px`，確保 `.hw-now` 的 `box-shadow: 0 0 0 2px` 不被父元素 `overflow: hidden` 裁切。

#### Scenario: 當前時段框線

- **WHEN** 天氣小時列顯示當前時段（`.hw-now`）
- **THEN** 藍色框線（box-shadow）SHALL 完整顯示，頂部不被裁切

### Requirement: 色彩模式預設 auto

`shared.js` 的色彩模式初始化 IIFE 在 localStorage 無 `color-mode` key 時，SHALL 使用 `window.matchMedia('(prefers-color-scheme: dark)')` 判斷，而非讀取舊的 `dark` key。

#### Scenario: 首次載入無 localStorage

- **WHEN** 使用者首次載入頁面，localStorage 無 `color-mode` key
- **THEN** 系統 SHALL 依據系統偏好（`prefers-color-scheme`）自動套用深色或亮色模式

#### Scenario: 系統偏好深色

- **WHEN** localStorage 無 `color-mode` 且系統偏好為 dark
- **THEN** 頁面 SHALL 套用 `body.dark` class

### Requirement: edit/setting 頁面底色

`.edit-page` 和 `.setting-page` 容器背景 SHALL 為 `var(--card-bg)`，與 sidebar 底色一致。

#### Scenario: 亮色模式底色一致

- **WHEN** 亮色模式下開啟 edit 或 setting 頁
- **THEN** 內容區背景 SHALL 為 `#EDE8E3`（同 sidebar）

#### Scenario: 深色模式底色一致

- **WHEN** 深色模式下開啟 edit 或 setting 頁
- **THEN** 內容區背景 SHALL 為 `#292624`（同 sidebar）
