## MODIFIED Requirements

### Requirement: 頁面整體 Layout 為聊天式
edit.html 的主要內容區域 SHALL 使用 flex column chat container，高度為 `100dvh - sticky-nav 高度`（含 `100vh` fallback），分為可捲動訊息區域與固定底部輸入框兩個子區域。

#### Scenario: Chat container 佔滿可視高度
- **WHEN** edit 頁面載入完成
- **THEN** chat container 高度為 viewport 高度減去 sticky nav 高度，無多餘空白，不出現頁面級別的捲軸

#### Scenario: 桌機版 sidebar 與 chat 分欄共存
- **WHEN** viewport width ≥ 768px
- **THEN** 現有 sidebar（行程資訊欄）與 chat container 以 CSS Grid 並排，chat container 佔主要寬度

### Requirement: 問候語區
問候語 SHALL 以左對齊系統訊息卡片方式渲染（含 Spark icon），時段規則不變：06:00–11:59 早安 / 12:00–17:59 午安 / 18:00–05:59 晚安，副標「有什麼行程修改需求？」。

#### Scenario: 早安問候顯示為系統訊息卡片
- **WHEN** 使用者於 06:00–11:59 開啟 edit.html
- **THEN** 訊息區域頂部顯示左對齊系統訊息卡片，卡片內含 Spark icon 與「早安！」問候語

#### Scenario: 副標文字顯示
- **WHEN** 問候語卡片渲染
- **THEN** 問候語下方顯示副標「有什麼行程修改需求？」

### Requirement: Issue 歷史紀錄
Issue 歷史 SHALL 透過 GitHub API（`--label trip-edit --state all --per_page 20`）拉取，每筆 issue 以右對齊氣泡渲染（含標題連結、編號、建立時間、open/closed 狀態標記）。載入中顯示「載入中…」，失敗顯示「無法載入紀錄」。

#### Scenario: Issues 以右對齊氣泡顯示
- **WHEN** GitHub API 成功回傳 issue 列表
- **THEN** 每筆 issue 渲染為右對齊氣泡，標題可點擊跳轉 GitHub，末尾顯示 open（綠點）或 closed（暗點）狀態標記

#### Scenario: 載入中狀態
- **WHEN** GitHub API 請求進行中
- **THEN** 訊息區域顯示「載入中…」文字

#### Scenario: 載入失敗狀態
- **WHEN** GitHub API 請求失敗
- **THEN** 訊息區域顯示「無法載入紀錄」文字
