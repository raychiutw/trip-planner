## MODIFIED Requirements

### Requirement: 底部輸入區

固定在頁面底部的卡片式佈局。

- **textarea**: 多行輸入，placeholder 含範例修改指令
- **工具列**: 僅包含送出按鈕（右側對齊）
- **送出按鈕狀態**: textarea 空 → `disabled` 暗色；有文字 → `var(--blue)` 可按

#### Scenario: 工具列元素

- **WHEN** edit 頁面載入完成
- **THEN** 工具列 SHALL 僅包含送出按鈕，SHALL NOT 包含 + 按鈕或行程選擇器

#### Scenario: 送出按鈕啟用

- **WHEN** textarea 有文字輸入
- **THEN** 送出按鈕 SHALL 啟用，背景色為 `var(--blue)`

### Requirement: Issue 歷史紀錄

透過 GitHub API 拉取 `--label trip-edit --state all --per_page 15` 的 Issues。顯示 issue 標題（可點擊跳轉 GitHub）、編號、建立時間。每筆前方顯示狀態圓點：open（綠色）/ closed（灰色）。區域獨立 `overflow-y: auto` 捲動。載入中顯示「載入中…」，失敗顯示「無法載入紀錄」。

#### Scenario: API 筆數限制

- **WHEN** 呼叫 GitHub API 取得 issue 列表
- **THEN** `per_page` 參數 SHALL 為 `15`

#### Scenario: issue 狀態顯示

- **WHEN** 渲染 issue 列表
- **THEN** 每筆 issue 前方 SHALL 顯示狀態圓點（open=綠色、closed=灰色）

## ADDED Requirements

### Requirement: 頁面響應式寬度

`.edit-page` 在桌機版 SHALL 最大寬度為 `60vw`，水平置中。在手機版（≤768px）SHALL 最大寬度為 `100%`，左右留 `12px` padding。

#### Scenario: 桌機版寬度

- **WHEN** 視窗寬度 > 768px
- **THEN** `.edit-page` 最大寬度 SHALL 為 `60vw`

#### Scenario: 手機版滿版

- **WHEN** 視窗寬度 ≤ 768px
- **THEN** `.edit-page` 最大寬度 SHALL 為 `100%`，padding 為 `0 12px`

## REMOVED Requirements

### Requirement: 底部輸入區 — + 按鈕

**Reason**: + 按鈕從未啟用（永遠 disabled），佔用工具列空間無實際用途
**Migration**: 直接移除 HTML 元素與 CSS 樣式，無功能影響

### Requirement: 底部輸入區 — 行程選擇器

**Reason**: 行程由 URL `?trip=` 參數決定，選擇器功能冗餘
**Migration**: 直接移除 HTML 元素、CSS 樣式與 `renderTripSelector()` 函式，行程切換改由選單導航
